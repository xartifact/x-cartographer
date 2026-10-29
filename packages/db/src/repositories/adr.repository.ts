import { createHash } from "node:crypto";
import { adrReviewEvents } from "../db/schema/adr-review-events";
import { products } from "../db/schema/products";
import type { AdrReview, AdrReviewEvent, CreateAdrReviewEventDTO } from "@x-cartographer/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ensureDb, type DbInstance } from "../db/client";
import { generateShortId } from "../lib/short-id";
import { adrRecords } from "../db/schema/adr-records";
import { statusChanges } from "../db/schema/status-changes";
import { milestones } from "../db/schema/milestones";
import { SystemModuleRepository } from "./system-module.repository";
import type {
  AdrRecord,
  AdrStatus,
  CreateAdrRecordDTO,
  CurrentConstitution,
} from "@x-cartographer/shared";

/**
 * 折叠后的"当前态"内部累积容器（§3.3）——按 id 定位做 upsert/remove。
 *
 * 注意：**不含 modules**。模块目录自 0006 起是独立实体（system-modules.ts），
 * 由 SystemModuleRepository 提供，不再参与 ADR 折叠——避免"两份真相"漂移
 * （docs/design/domain-model.md §6.4）。ADR 仅通过 module_ids 标注涉及范围。
 */
interface ConstitutionMaps {
  techStack: Map<string, CurrentConstitution["tech_stack"][number]>;
  principles: Map<string, CurrentConstitution["architecture_principles"][number]>;
}

/**
 * 对单条 ADR 的 changes 做一次折叠应用（§3.3 的 apply）：
 * upsert 是整体替换/插入（按 id 定位），remove 是显式删除——
 * 撤销动作永远是显式 remove，不是 status 变化的副作用（§3.1 关键纠正）。
 */
function applyChanges(maps: ConstitutionMaps, record: AdrRecord): void {
  const delta = record.changes;
  if (!delta) return;
  for (const entry of delta.tech_stack?.upsert ?? []) {
    maps.techStack.set(entry.id, entry);
  }
  for (const id of delta.tech_stack?.remove ?? []) {
    maps.techStack.delete(id);
  }
  for (const entry of delta.architecture_principles?.upsert ?? []) {
    maps.principles.set(entry.id, entry);
  }
  for (const id of delta.architecture_principles?.remove ?? []) {
    maps.principles.delete(id);
  }
  // delta.modules 不再参与折叠（模块目录已独立成表，见上方注释）
}

/**
 * 折叠算法（**模块私有**，§3.3）：records 必须已按 seq 升序排列，
 * 依次应用每条 ADR 的 changes（upsert set / remove delete），
 * 返回"当前态"投影。modules 恒为空数组——调用方负责从 system_modules 表补齐。
 *
 * **刻意不导出**：本函数不感知 `acceptedAt`——喂什么就折叠什么，自身无法区分
 * "已生效"与"仍是提案"。曾作为公开导出被 ctx 直接调用
 * （`foldConstitution(listByProject(...))`），绕过 §3.3「只折叠已 accepted」，
 * 把 proposed ADR 的 changes 当生效约束注入。折叠的唯一合法入口是下方仓库方法，
 * 它们都过 `acceptedAt` 过滤。
 */
function foldConstitution(records: AdrRecord[]): CurrentConstitution {
  const rule_sources: Record<string, string> = {};
  const maps: ConstitutionMaps = {
    techStack: new Map(),
    principles: new Map(),
  };
  for (const record of records) {
    applyChanges(maps, record);
    for (const category of ["tech_stack", "architecture_principles"] as const) {
      for (const entry of record.changes?.[category]?.upsert ?? [])
        rule_sources[`${category}:${entry.id}`] = record.id;
      for (const id of record.changes?.[category]?.remove ?? [])
        delete rule_sources[`${category}:${id}`];
    }
  }
  return {
    rule_sources,
    tech_stack: [...maps.techStack.values()],
    architecture_principles: [...maps.principles.values()],
    modules: [], // 由调用方从 system_modules 表填充
  };
}

type Reader = Pick<DbInstance, "select">;
type Writer = Pick<DbInstance, "select" | "insert" | "update">;
export class AdrReviewError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: 400 | 404 | 409 = 409,
  ) {
    super(message);
  }
}
const transitions: Record<AdrStatus, AdrStatus[]> = {
  proposed: ["accepted", "rejected"],
  accepted: ["deprecated", "superseded"],
  rejected: [],
  deprecated: [],
  superseded: [],
};

export class AdrRepository {
  private toRecord(row: typeof adrRecords.$inferSelect): AdrRecord {
    return {
      id: row.id,
      product_id: row.projectId,
      title: row.title,
      status: row.status as AdrStatus,
      context: row.context,
      decision: row.decision,
      consequences: row.consequences ?? undefined,
      alternatives_considered: row.alternativesConsidered ?? undefined,
      supersedes: row.supersedes ?? undefined,
      revises: row.revises ?? undefined,
      milestone_id: row.milestoneId ?? undefined,
      module_ids: row.moduleIds,
      changes: row.changes ?? undefined,
      provenance: row.provenance,
      created_at: row.createdAt.toISOString(),
      seq: row.seq,
    };
  }

  private async records(db: Reader, productId: string) {
    const rows = await db
      .select()
      .from(adrRecords)
      .where(eq(adrRecords.projectId, productId))
      .orderBy(asc(adrRecords.seq));
    const records = rows.map((r) => this.toRecord(r));
    for (const r of records) r.revised_by = records.find((n) => n.revises === r.id)?.id;
    return records;
  }

  async listByProject(productId: string) {
    return this.records(await ensureDb(), productId);
  }

  async findById(id: string): Promise<AdrRecord | null> {
    const db = await ensureDb();
    const [row] = await db.select().from(adrRecords).where(eq(adrRecords.id, id));
    if (!row) return null;
    const [next] = await db
      .select({ id: adrRecords.id })
      .from(adrRecords)
      .where(eq(adrRecords.revises, id));
    return { ...this.toRecord(row), revised_by: next?.id };
  }

  // Every ADR/review mutation takes the same product-row lock before reading the ledger.
  // This serializes preview checks, new proposals, opinions and decisions on both DB drivers.
  private async lock(db: Writer, productId: string) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .for("update");
    if (!product) throw new AdrReviewError("product_not_found", "产品不存在", 404);
  }

  private lineage(records: AdrRecord[], adr: AdrRecord) {
    const chain: AdrRecord[] = [];
    let current: AdrRecord | undefined = adr;
    while (current && !chain.some((r) => r.id === current!.id)) {
      chain.unshift(current);
      current = records.find((r) => r.id === current!.revises);
    }
    return chain;
  }

  private async snapshot(db: Reader, productId: string) {
    const records = await this.records(db, productId);
    if (!records.length) return { records, history: [], events: [] as AdrReviewEvent[] };
    const ids = records.map((r) => r.id);
    const history = await db
      .select()
      .from(statusChanges)
      .where(and(eq(statusChanges.entityType, "adr"), inArray(statusChanges.entityId, ids)))
      .orderBy(asc(statusChanges.seq));
    const rows = await db
      .select()
      .from(adrReviewEvents)
      .where(inArray(adrReviewEvents.adrId, ids))
      .orderBy(asc(adrReviewEvents.seq));
    const events: AdrReviewEvent[] = rows.map((r) => ({
      id: r.id,
      adr_id: r.adrId,
      kind: r.kind,
      comment_id: r.commentId ?? undefined,
      target: r.target ?? undefined,
      body: r.body,
      blocking: r.blocking,
      created_at: r.createdAt.toISOString(),
      seq: r.seq,
    }));
    return { records, history, events };
  }

  private acceptedAt(
    record: AdrRecord,
    history: Awaited<ReturnType<AdrRepository["snapshot"]>>["history"],
  ) {
    const accepted = history.find((e) => e.entityId === record.id && e.newStatus === "accepted");
    if (accepted) return accepted.changedAt;
    // Directly-created accepted records have no initial transition event.
    if (
      record.status === "accepted" ||
      record.status === "deprecated" ||
      record.status === "superseded"
    )
      return new Date(record.created_at);
    return null;
  }

  private reviewFrom(
    snapshot: Awaited<ReturnType<AdrRepository["snapshot"]>>,
    id: string,
  ): AdrReview {
    const { records, history, events: allEvents } = snapshot;
    const adr = records.find((r) => r.id === id);
    if (!adr) throw new AdrReviewError("adr_not_found", "ADR 不存在", 404);
    const lineage = this.lineage(records, adr);
    const events = allEvents.filter((e) => lineage.some((r) => r.id === e.adr_id));
    const resolved = new Set(events.filter((e) => e.kind === "resolve").map((e) => e.comment_id));
    const effective = records.filter((r) => this.acceptedAt(r, history) !== null);
    return {
      adr,
      lineage,
      events,
      unresolved_count: events.filter(
        (e) => e.kind === "comment" && e.blocking && !resolved.has(e.id),
      ).length,
      review_token: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
      before: foldConstitution(effective),
      after: foldConstitution(
        records.filter(
          (r) =>
            effective.some((a) => a.id === r.id) ||
            (r.id === id && r.status === "proposed" && !r.revised_by),
        ),
      ),
    };
  }

  async getReview(id: string): Promise<AdrReview> {
    const record = await this.findById(id);
    if (!record) throw new AdrReviewError("adr_not_found", "ADR 不存在", 404);
    const db = await ensureDb();
    return db.transaction(async (tx) => {
      await this.lock(tx, record.product_id);
      return this.reviewFrom(await this.snapshot(tx, record.product_id), id);
    });
  }

  private async writeStatus(
    db: Writer,
    record: AdrRecord,
    status: AdrStatus,
    reason: string,
    eventId: string,
  ) {
    if (!transitions[record.status].includes(status))
      throw new AdrReviewError(
        "invalid_transition",
        `不允许 ${record.status} → ${status}，请刷新后重试`,
      );
    const updated = await db
      .update(adrRecords)
      .set({ status })
      .where(and(eq(adrRecords.id, record.id), eq(adrRecords.status, record.status)))
      .returning({ id: adrRecords.id });
    if (!updated.length) throw new AdrReviewError("stale_status", "状态已改变，请重新评审");
    await db.insert(statusChanges).values({
      id: eventId,
      entityId: record.id,
      entityType: "adr",
      previousStatus: record.status,
      newStatus: status,
      reason,
      changedAt: new Date(),
    });
  }

  async create(dto: CreateAdrRecordDTO): Promise<AdrRecord> {
    const db = await ensureDb();
    const id = await generateShortId("adr");
    const eventId = dto.supersedes ? await generateShortId("statusChange") : "";
    return db.transaction(async (tx) => {
      await this.lock(tx, dto.product_id);
      const records = await this.records(tx, dto.product_id);
      if (dto.revises) {
        const parent = records.find((r) => r.id === dto.revises);
        if (!parent || parent.status !== "proposed" || parent.revised_by)
          throw new AdrReviewError("invalid_revision", "只能修订同产品中尚无新版的待评审提案");
        if (dto.status && dto.status !== "proposed")
          throw new AdrReviewError("revision_requires_review", "修订必须重新提交评审", 400);
      }
      const old = dto.supersedes ? records.find((r) => r.id === dto.supersedes) : undefined;
      if (dto.supersedes && (!old || old.status !== "accepted"))
        throw new AdrReviewError("invalid_supersedes", "只能替代同产品中已采纳的 ADR", 400);
      if (dto.milestone_id) {
        const [ms] = await tx.select().from(milestones).where(eq(milestones.id, dto.milestone_id));
        if (!ms || ms.projectId !== dto.product_id)
          throw new AdrReviewError("invalid_milestone", "版本必须属于当前产品", 400);
      }
      if (dto.status === "superseded" || dto.status === "deprecated")
        throw new AdrReviewError(
          "invalid_initial_status",
          "新 ADR 不能直接创建为废弃或被替代状态",
          400,
        );
      const [row] = await tx
        .insert(adrRecords)
        .values({
          id,
          projectId: dto.product_id,
          title: dto.title,
          status: dto.status ?? "proposed",
          context: dto.context,
          decision: dto.decision,
          consequences: dto.consequences,
          alternativesConsidered: dto.alternatives_considered,
          supersedes: dto.supersedes,
          revises: dto.revises,
          milestoneId: dto.milestone_id,
          moduleIds: dto.module_ids ?? [],
          changes: dto.changes,
          provenance: dto.provenance ?? "agent_inferred",
          createdAt: new Date(),
        })
        .returning();
      // A proposal does not retire its predecessor before it is adopted.
      if (old && dto.status === "accepted")
        await this.writeStatus(tx, old, "superseded", `由 ${id} 替代`, eventId);
      return this.toRecord(row!);
    });
  }

  async transitionStatus(
    id: string,
    newStatus: AdrStatus,
    reason?: string,
    reviewToken?: string,
    expectedStatus?: AdrStatus,
  ): Promise<void> {
    if (!reason?.trim()) throw new AdrReviewError("reason_required", "请填写决定理由", 400);
    const record = await this.findById(id);
    if (!record) throw new AdrReviewError("adr_not_found", "ADR 不存在", 404);
    const db = await ensureDb();
    const eventId = await generateShortId("statusChange");
    const supersedeEventId =
      record.supersedes && newStatus === "accepted" ? await generateShortId("statusChange") : "";
    await db.transaction(async (tx) => {
      await this.lock(tx, record.product_id);
      const snapshot = await this.snapshot(tx, record.product_id);
      const review = this.reviewFrom(snapshot, id);
      if (expectedStatus && review.adr.status !== expectedStatus)
        throw new AdrReviewError("stale_status", "状态已改变，请重新评审");
      if (reviewToken && reviewToken !== review.review_token)
        throw new AdrReviewError("stale_review", "评审期间账本或意见已变化，请刷新并重新确认");
      if (newStatus === "accepted") {
        if (review.adr.revised_by)
          throw new AdrReviewError("newer_revision", "已有新修订，请评审最新版");
        if (review.unresolved_count)
          throw new AdrReviewError("unresolved_comments", "仍有未解决的修改意见");
      }
      await this.writeStatus(tx, review.adr, newStatus, reason.trim(), eventId);
      if (newStatus === "accepted" && review.adr.supersedes) {
        const old = snapshot.records.find((r) => r.id === review.adr.supersedes);
        if (!old) throw new AdrReviewError("invalid_supersedes", "被替代的 ADR 不存在");
        await this.writeStatus(tx, old, "superseded", `由 ${id} 替代`, supersedeEventId);
      }
    });
  }

  async addReviewEvent(id: string, input: CreateAdrReviewEventDTO): Promise<AdrReviewEvent> {
    const record = await this.findById(id);
    if (!record) throw new AdrReviewError("adr_not_found", "ADR 不存在", 404);
    if (!input.body.trim())
      throw new AdrReviewError("body_required", "意见或处理理由不能为空", 400);
    const eventId = await generateShortId("adrReview");
    const db = await ensureDb();
    return db.transaction(async (tx) => {
      await this.lock(tx, record.product_id);
      const review = this.reviewFrom(await this.snapshot(tx, record.product_id), id);
      if (review.adr.status !== "proposed" || review.adr.revised_by)
        throw new AdrReviewError("review_closed", "请在最新待评审提案上操作");
      if (input.kind === "comment") {
        if (input.commentId)
          throw new AdrReviewError("invalid_comment", "新意见不能指定父意见", 400);
        if (input.target) {
          const targets = new Set(
            review.lineage.flatMap((proposal) =>
              ["tech_stack", "architecture_principles"].flatMap((key) => {
                const delta = proposal.changes?.[key as "tech_stack" | "architecture_principles"];
                return [
                  ...(delta?.upsert ?? []).map((e) => `${key}:${e.id}`),
                  ...(delta?.remove ?? []).map((v) => `${key}:${v}`),
                ];
              }),
            ),
          );
          if (!targets.has(input.target))
            throw new AdrReviewError("invalid_target", "意见目标不在当前修订链的提案变更中", 400);
        }
      } else {
        const comment = review.events.find((e) => e.id === input.commentId && e.kind === "comment");
        if (!comment) throw new AdrReviewError("invalid_comment", "父意见不属于这条修订链", 400);
        if (input.target || input.blocking)
          throw new AdrReviewError("invalid_reply", "回复或解决不能重新指定目标和阻塞类型", 400);
        if (
          input.kind === "resolve" &&
          review.events.some((e) => e.kind === "resolve" && e.comment_id === input.commentId)
        )
          throw new AdrReviewError("already_resolved", "这条意见已解决");
      }
      const [row] = await tx
        .insert(adrReviewEvents)
        .values({
          id: eventId,
          adrId: id,
          kind: input.kind,
          commentId: input.commentId,
          target: input.target,
          body: input.body.trim(),
          blocking: input.kind === "comment" && !!input.blocking,
        })
        .returning();
      return {
        id: row!.id,
        adr_id: id,
        kind: row!.kind,
        comment_id: row!.commentId ?? undefined,
        target: row!.target ?? undefined,
        body: row!.body,
        blocking: row!.blocking,
        created_at: row!.createdAt.toISOString(),
        seq: row!.seq,
      };
    });
  }

  async getEffectiveConstitution(productId: string): Promise<CurrentConstitution> {
    const snapshot = await this.snapshot(await ensureDb(), productId);
    return foldConstitution(
      snapshot.records.filter((r) => this.acceptedAt(r, snapshot.history) !== null),
    );
  }

  async getCurrentConstitution(productId: string): Promise<CurrentConstitution> {
    const constitution = await this.getEffectiveConstitution(productId);
    constitution.modules = await new SystemModuleRepository().findByProductId(productId);
    return constitution;
  }

  async getConstitutionAsOfMilestone(milestoneId: string): Promise<CurrentConstitution> {
    const db = await ensureDb();
    const [ms] = await db.select().from(milestones).where(eq(milestones.id, milestoneId));
    if (!ms) throw new Error(`Milestone ${milestoneId} not found`);
    const snapshot = await this.snapshot(db, ms.projectId);
    return foldConstitution(
      snapshot.records.filter((r) => {
        const at = this.acceptedAt(r, snapshot.history);
        return at !== null && at <= ms.createdAt;
      }),
    );
  }
}
