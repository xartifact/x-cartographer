import { and, asc, eq } from 'drizzle-orm';
import { ensureDb } from '../db/client';
import { adrRecords } from '../db/schema/adr-records';
import { statusChanges } from '../db/schema/status-changes';
import { milestones } from '../db/schema/milestones';
import type {
  AdrRecord,
  AdrStatus,
  CreateAdrRecordDTO,
  CurrentConstitution,
} from '@x-cartographer/shared';

/**
 * 折叠后的"当前态"内部累积容器（§3.3）——三类 Map 按 id 定位做 upsert/remove。
 */
interface ConstitutionMaps {
  techStack: Map<string, CurrentConstitution['tech_stack'][number]>;
  principles: Map<string, CurrentConstitution['architecture_principles'][number]>;
  modules: Map<string, CurrentConstitution['modules'][number]>;
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
  for (const entry of delta.modules?.upsert ?? []) {
    maps.modules.set(entry.id, entry);
  }
  for (const id of delta.modules?.remove ?? []) {
    maps.modules.delete(id);
  }
}

/**
 * 折叠算法（纯函数，§3.3）：records 必须已按 seq 升序排列，
 * 依次应用每条 ADR 的 changes（upsert set / remove delete），
 * 返回三类条目数组组成的"当前态"投影。
 */
export function foldConstitution(records: AdrRecord[]): CurrentConstitution {
  const maps: ConstitutionMaps = {
    techStack: new Map(),
    principles: new Map(),
    modules: new Map(),
  };
  for (const record of records) {
    applyChanges(maps, record);
  }
  return {
    tech_stack: [...maps.techStack.values()],
    architecture_principles: [...maps.principles.values()],
    modules: [...maps.modules.values()],
  };
}

export class AdrRepository {
  /**
   * 创建 ADR（仅追加，除 status 外不可变，§3.1）。
   * dto.supersedes 存在时，对被替代的旧 ADR 做结构性联动：
   * 状态转 superseded 并写 status_changes 账本（理由"由 ADR-{new_id} 替代"，§3.1）——
   * 联动只影响文档标签，不碰旧记录的 changes，折叠结果不受影响。
   */
  async create(dto: CreateAdrRecordDTO): Promise<AdrRecord> {
    const db = await ensureDb();
    const id = crypto.randomUUID(); // packages/db 无 nanoid 依赖，改用标准库（见偏差报告）
    await db.insert(adrRecords).values({
      id,
      projectId: dto.product_id,
      title: dto.title,
      status: dto.status ?? 'proposed',
      context: dto.context,
      decision: dto.decision,
      consequences: dto.consequences ?? null,
      alternativesConsidered: dto.alternatives_considered ?? null,
      supersedes: dto.supersedes ?? null,
      milestoneId: dto.milestone_id ?? null,
      moduleIds: dto.module_ids ?? [],
      changes: dto.changes ?? null,
      createdAt: new Date(),
    });

    // supersedes 结构性联动（§3.1）：只动 status 标签与账本，不改旧记录 changes
    if (dto.supersedes) {
      await this.transitionStatus(
        dto.supersedes,
        'superseded',
        `由 ADR-${id} 替代`
      );
    }

    const created = await this.findById(id);
    if (!created) {
      throw new Error(`ADR 记录创建后读取失败: ${id}`);
    }
    return created;
  }

  async findById(id: string): Promise<AdrRecord | null> {
    const db = await ensureDb();
    const rows = await db
      .select()
      .from(adrRecords)
      .where(eq(adrRecords.id, id));
    return rows[0] ? this.toRecord(rows[0]) : null;
  }

  /**
   * 项目下全部 ADR，按 seq 升序（§3.3：seq 是折叠排序的唯一权威依据）。
   */
  async listByProject(projectId: string): Promise<AdrRecord[]> {
    const db = await ensureDb();
    const rows = await db
      .select()
      .from(adrRecords)
      .where(eq(adrRecords.projectId, projectId))
      .orderBy(asc(adrRecords.seq));
    return rows.map((row) => this.toRecord(row));
  }

  /**
   * ADR 状态流转（§3.1）：双写 status_changes 审计账本（每次必须带理由）与
   * adr_records.status 标签。允许的流转由调用方（server 路由）校验，repo 不重复校验。
   */
  async transitionStatus(
    id: string,
    newStatus: AdrStatus,
    reason?: string
  ): Promise<void> {
    const db = await ensureDb();
    const current = await this.findById(id);
    if (!current) {
      throw new Error(`ADR 记录不存在: ${id}`);
    }
    // 1) 审计账本：entity_type 'adr'（shared 类型已拓宽，common.ts）
    await db.insert(statusChanges).values({
      id: crypto.randomUUID(),
      entityId: id,
      entityType: 'adr',
      previousStatus: current.status,
      newStatus,
      reason: reason ?? null,
      changedAt: new Date(),
    });
    // 2) 状态标签更新
    await db
      .update(adrRecords)
      .set({ status: newStatus })
      .where(eq(adrRecords.id, id));
  }

  /**
   * 某条 ADR 何时进入过 accepted（§3.1）。两条路径：
   * 1) 正常流转：status_changes 里 new_status='accepted' 的转移记录
   *    （状态机保证 proposed→accepted 至多一次，无"第一次 vs 最近一次"歧义）；
   * 2) 直创 accepted（create 时 status='accepted'，不经 transitionStatus，
   *    账本无记录）：acceptedAt = 创建时刻（§3.1 明文规定）。
   * 返回 null = 从未 accept 过（proposed/rejected），天然不参与折叠。
   */
  private async acceptedAt(
    recordId: string,
    record: AdrRecord
  ): Promise<Date | null> {
    if (record.status === 'rejected' || record.status === 'proposed') {
      return null;
    }
    const db = await ensureDb();
    const rows = await db
      .select({ changedAt: statusChanges.changedAt })
      .from(statusChanges)
      .where(
        and(
          eq(statusChanges.entityId, recordId),
          eq(statusChanges.entityType, 'adr'),
          eq(statusChanges.newStatus, 'accepted')
        )
      )
      .limit(1);
    if (rows[0]) return rows[0].changedAt;
    // 账本无记录：仅直创 accepted 场景（deprecated/superseded 必然经历过
    // transitionStatus，账本必有 accepted 记录，走不到这里）
    return new Date(record.created_at);
  }

  /**
   * 当前态查询（§3.3）：折叠只看 acceptedAt，不看当前 status——
   * deprecated/superseded 标签不影响已生效的 changes（§3.1 反例：
   * "不再是权威说法" ≠ "撤销引入的状态"）；rejected 从未 accept，天然排除。
   * 只要求 changes 非空的记录参与折叠。
   */
  async getCurrentConstitution(projectId: string): Promise<CurrentConstitution> {
    const records = await this.listByProject(projectId);
    const folded: AdrRecord[] = [];
    for (const r of records) {
      if (r.changes === undefined) continue;
      if ((await this.acceptedAt(r.id, r)) === null) continue;
      folded.push(r);
    }
    return foldConstitution(folded);
  }

  /**
   * 历史态查询（§3.3）：折叠只应用 acceptedAt <= 里程碑创建时刻 的记录，
   * 即「该版本交付时刻」的宪法投影。参数为里程碑 id。
   */
  async getConstitutionAsOfMilestone(milestoneId: string): Promise<CurrentConstitution> {
    const db = await ensureDb();
    const ms = await db.query.milestones.findFirst({ where: eq(milestones.id, milestoneId) });
    if (!ms) throw new Error(`Milestone ${milestoneId} not found`);
    const records = await this.listByProject(ms.projectId);
    const folded: AdrRecord[] = [];
    for (const r of records) {
      if (r.changes === undefined) continue;
      const at = await this.acceptedAt(r.id, r);
      if (at === null || at > ms.createdAt) continue;
      folded.push(r);
    }
    return foldConstitution(folded);
  }

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
      milestone_id: row.milestoneId ?? undefined,
      module_ids: row.moduleIds,
      changes: row.changes ?? undefined,
      created_at: row.createdAt.toISOString(),
      seq: row.seq,
    };
  }
}
