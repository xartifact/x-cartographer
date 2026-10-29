"use client";
import { useFormDraft } from "@/lib/hooks/use-form-draft";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Textarea,
  Label,
} from "@x-cartographer/ui";
import type {
  AdrRecord,
  AdrStatus,
  CreateAdrReviewEventDTO,
  StatusChangeRecord,
} from "@x-cartographer/shared";
import { api } from "@/lib/api/client";
import { toApiError } from "@/lib/api/error";
import {
  useAdrReview,
  useAddAdrReviewEvent,
  useUpdateAdrStatus,
} from "@/lib/api/hooks/use-constitution";
import { ChangeList, Markdown, constitutionDiff, proposalRows } from "./adr-changes";
export const ADR_STATUS_LABEL: Record<string, string> = {
  proposed: "待评审",
  accepted: "已采纳",
  rejected: "已否决",
  deprecated: "已废弃",
  superseded: "被替代",
};
type Tab = "changes" | "preview" | "evidence" | "discussion";
export function AdrRevisionSheet({
  id,
  onClose,
  onSelect,
  onRevise,
  onDecided,
  modules,
  milestoneNames,
}: {
  id: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onRevise: (adr: AdrRecord) => void;
  onDecided: (status: AdrStatus) => void;
  modules: ReadonlyMap<string, string>;
  milestoneNames: ReadonlyMap<string, string>;
}) {
  const query = useAdrReview(id ?? "");
  const add = useAddAdrReviewEvent();
  const update = useUpdateAdrStatus();
  const [tab, setTab] = useState<Tab>("changes");
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [compose, setCompose] = useState<Omit<CreateAdrReviewEventDTO, "body"> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const opinionDraft = useFormDraft({
    open: !!id,
    scope: `adr-opinions:${id}`,
    values: { drafts },
    restore: (value) => setDrafts(value.drafts),
    close: onClose,
    saving: add.isPending || update.isPending,
  });
  const draftKey = compose ? `${compose.kind}:${compose.target ?? compose.commentId ?? "all"}` : "";
  const draft = drafts[draftKey] ?? "";
  const [decision, setDecision] = useState<{ status: AdrStatus; token: string } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const review = query.data;
  const adr = review?.adr;
  const history = useQuery({
    queryKey: ["status-changes", id],
    enabled: !!id,
    queryFn: async (): Promise<StatusChangeRecord[]> => {
      const res = await api.api["status-changes"].$get({ query: { entityId: id! } });
      if (!res.ok) throw await toApiError(res, "加载决定历史失败");
      return (await res.json()) as StatusChangeRecord[];
    },
  });
  const resolved = useMemo(
    () => new Set(review?.events.filter((e) => e.kind === "resolve").map((e) => e.comment_id)),
    [review],
  );
  const comments = review?.events.filter((e) => e.kind === "comment") ?? [];
  const parent = review?.lineage.at(-2);
  const isPending = adr?.status === "proposed" && !adr.revised_by;
  const allRows = proposalRows(adr?.changes, isPending && !parent ? review?.before : undefined);
  const previousRows = proposalRows(parent?.changes);
  const revisionRows = [
    ...new Set([...allRows.map((r) => r.key), ...previousRows.map((r) => r.key)]),
  ].flatMap((key) => {
    const before = previousRows.find((r) => r.key === key);
    const after = allRows.find((r) => r.key === key);
    if (JSON.stringify(before) === JSON.stringify(after)) return [];
    return [{ ...(after ?? before!), before: before?.after, after: after?.after }];
  });
  const rows = parent && onlyChanged ? revisionRows : allRows;
  const effectiveDiff = review ? constitutionDiff(review.before, review.after) : [];
  function startComment(target?: string) {
    setCompose({ kind: "comment", target, blocking: true });
    setError("");
  }
  async function saveOpinion() {
    if (!draft.trim()) {
      setError("请填写意见或处理理由。");
      return;
    }
    try {
      await add.mutateAsync({ id: id!, input: { ...compose!, body: draft } });
      setDrafts({ ...drafts, [draftKey]: "" });
      setCompose(null);
      setTab("discussion");
      toast.success("评审记录已保存");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }
  async function decide() {
    if (!reason.trim()) {
      setError("请填写决定理由。");
      return;
    }
    try {
      await update.mutateAsync({
        id: id!,
        productId: adr!.product_id,
        status: decision!.status,
        reason,
        reviewToken: decision!.token,
        expectedStatus: adr!.status,
      });
      toast.success("决定已保存", {
        description:
          decision!.status === "accepted"
            ? "当前规则已更新，主张来源保持不变。"
            : "决定理由已记录。",
      });
      onDecided(decision!.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    }
  }
  return (
    <>
      <Sheet
        open={!!id}
        onOpenChange={(value) => {
          if (!value && !add.isPending && !update.isPending) opinionDraft.requestClose();
        }}
      >
        <SheetContent className="adr-sheet w-full sm:max-w-[1040px] p-0 gap-0">
          {opinionDraft.protection}
          <SheetHeader className="adr-review-header">
            <div className="adr-row adr-wrap">
              <span className="adr-eyebrow">{id}</span>
              <span className="adr-pill">
                {adr ? (adr.revised_by ? "已有新修订" : ADR_STATUS_LABEL[adr.status]) : "加载中"}
              </span>
              {adr && (
                <span className="adr-meta">
                  {adr.provenance === "agent_inferred"
                    ? "Agent 推断"
                    : adr.provenance === "human_asserted"
                      ? "人直接主张"
                      : "外部导入"}
                </span>
              )}
            </div>
            <SheetTitle>{adr?.title ?? "ADR 评审"}</SheetTitle>
            <SheetDescription>阅读提案与生效变化，留下判断依据。</SheetDescription>
          </SheetHeader>
          {query.isLoading ? (
            <div className="adr-empty">
              <Loader2 className="animate-spin" />
              加载评审…
            </div>
          ) : query.error ? (
            <div role="alert" className="adr-empty">
              <p>{query.error.message}</p>
              <Button onClick={() => void query.refetch()}>重新加载</Button>
            </div>
          ) : (
            review &&
            adr && (
              <>
                <nav className="adr-tabs adr-detail-tabs" aria-label="提案内容">
                  {(
                    [
                      ["changes", "规则变更"],
                      ["preview", "生效预览"],
                      ["evidence", "背景与依据"],
                      ["discussion", `评审意见 · ${comments.length}`],
                    ] as const
                  ).map(([key, name]) => (
                    <button
                      key={key}
                      type="button"
                      aria-current={tab === key ? "page" : undefined}
                      className={tab === key ? "selected" : ""}
                      onClick={() => setTab(key)}
                    >
                      {name}
                    </button>
                  ))}
                </nav>
                <div className="adr-review-body">
                  {adr.revised_by && (
                    <div className="adr-callout">
                      此提案已有新修订，不能继续采纳。
                      <button className="adr-text-action" onClick={() => onSelect(adr.revised_by!)}>
                        查看 {adr.revised_by} <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                  {tab === "changes" && (
                    <>
                      <div className="adr-summary">
                        <div>
                          <strong>
                            {adr.changes?.architecture_principles?.upsert?.length ?? 0}
                          </strong>
                          <span>原则写入</span>
                        </div>
                        <div>
                          <strong>{adr.changes?.tech_stack?.upsert?.length ?? 0}</strong>
                          <span>技术栈写入</span>
                        </div>
                        <div>
                          <strong>
                            {(adr.changes?.architecture_principles?.remove?.length ?? 0) +
                              (adr.changes?.tech_stack?.remove?.length ?? 0)}
                          </strong>
                          <span>显式删除</span>
                        </div>
                      </div>
                      <section className="adr-callout">
                        <h3>建议作出的决定</h3>
                        <Markdown>{adr.decision}</Markdown>
                      </section>
                      <div className="adr-section-heading">
                        <h2>{parent ? "本轮修订" : "提案变更"}</h2>
                        {parent && (
                          <label className="adr-check">
                            <input
                              type="checkbox"
                              checked={onlyChanged}
                              onChange={(e) => setOnlyChanged(e.target.checked)}
                            />
                            只看本轮改动
                          </label>
                        )}
                      </div>
                      {parent && (
                        <p className="adr-meta mb-3">
                          与{" "}
                          <button className="adr-text-action" onClick={() => onSelect(parent.id)}>
                            {parent.id}
                          </button>{" "}
                          对比；撤回提案条目不等于删除生效规则。修订不会自动解决评审意见。
                          {parent.decision !== adr.decision || parent.context !== adr.context
                            ? "背景或决策说明也有更新，请复核「背景与依据」。"
                            : ""}
                        </p>
                      )}
                      {rows.length ? (
                        <ChangeList
                          rows={rows}
                          modules={modules}
                          onComment={isPending ? startComment : undefined}
                        />
                      ) : (
                        <p className="adr-empty">
                          {parent && onlyChanged
                            ? "本轮没有结构化规则改动；请查看背景与依据。"
                            : "未声明规则变化，仅记录决策。"}
                        </p>
                      )}
                      {adr.changes?.modules && (
                        <div className="adr-callout">
                          这条历史记录含旧模块变更；模块目录已独立维护，此部分不参与生效计算。
                        </div>
                      )}
                    </>
                  )}
                  {tab === "preview" && (
                    <>
                      <div className="adr-callout">
                        <h3>
                          {isPending
                            ? "若现在采纳，当前规则将发生以下变化"
                            : "此记录已结束评审，以下为当前基线"}
                        </h3>
                        <p>
                          按原始账本顺序重算，后续 ADR
                          可能覆盖本提案的部分变化。废弃或替代标签不会撤销已经引入的规则。
                        </p>
                      </div>
                      <div className="adr-section-heading">
                        <h2>{isPending ? `实际变化 · ${effectiveDiff.length}` : "当前生效规则"}</h2>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={query.isFetching}
                          onClick={() => void query.refetch()}
                        >
                          <RefreshCw size={14} />
                          重新计算
                        </Button>
                      </div>
                      {isPending ? (
                        effectiveDiff.length ? (
                          <ChangeList rows={effectiveDiff} modules={modules} />
                        ) : (
                          <p className="adr-empty">
                            采纳不会改变当前规则。提案可能只更新决策依据，或已被后续规则覆盖。
                          </p>
                        )
                      ) : (
                        <ChangeList
                          current
                          rows={proposalRows({
                            architecture_principles: {
                              upsert: review.before.architecture_principles,
                            },
                            tech_stack: { upsert: review.before.tech_stack },
                          })}
                          modules={modules}
                        />
                      )}
                    </>
                  )}
                  {tab === "evidence" && (
                    <div className="adr-evidence">
                      {[
                        ["背景", adr.context],
                        ["决策", adr.decision],
                        ["后果与代价", adr.consequences],
                        ["考虑过的替代方案", adr.alternatives_considered],
                      ].map(
                        ([title, text]) =>
                          text && (
                            <section key={title}>
                              <h2>{title}</h2>
                              <Markdown>{text}</Markdown>
                            </section>
                          ),
                      )}
                      <section>
                        <h2>来源与关联</h2>
                        <p className="adr-meta">
                          创建于 {new Date(adr.created_at).toLocaleString()} · {adr.provenance}
                        </p>
                        {adr.milestone_id && (
                          <p>
                            关联版本：{milestoneNames.get(adr.milestone_id) ?? adr.milestone_id}
                          </p>
                        )}
                        {adr.supersedes && (
                          <button
                            className="adr-text-action"
                            onClick={() => onSelect(adr.supersedes!)}
                          >
                            替代 {adr.supersedes}
                          </button>
                        )}
                        <div className="adr-row adr-wrap">
                          {review.lineage.map((r) => (
                            <button
                              className="adr-text-action"
                              key={r.id}
                              onClick={() => onSelect(r.id)}
                            >
                              {r.id}
                              {r.id === adr.id ? "（当前）" : ""}
                            </button>
                          ))}
                        </div>
                      </section>
                      <section>
                        <h2>决定历史</h2>
                        {history.isLoading ? (
                          <p>加载中…</p>
                        ) : history.error ? (
                          <p role="alert">{history.error.message}</p>
                        ) : history.data?.length ? (
                          history.data.map((h) => (
                            <div className="adr-history-event" key={h.id}>
                              <span className="adr-meta">
                                {new Date(h.changed_at).toLocaleString()} ·{" "}
                                {ADR_STATUS_LABEL[h.previous_status] ?? h.previous_status} →{" "}
                                {ADR_STATUS_LABEL[h.new_status] ?? h.new_status}
                              </span>
                              <Markdown>{h.reason ?? "未记录理由（历史数据）"}</Markdown>
                            </div>
                          ))
                        ) : (
                          <p className="adr-meta">
                            暂无状态流转记录
                            {adr.status === "accepted" ? "，此 ADR 直接以已采纳状态创建。" : "。"}
                          </p>
                        )}
                      </section>
                      <details>
                        <summary>原始变更 JSON</summary>
                        <pre>{JSON.stringify(adr.changes ?? {}, null, 2)}</pre>
                      </details>
                    </div>
                  )}
                  {tab === "discussion" && (
                    <>
                      <div className="adr-section-heading">
                        <h2>评审意见</h2>
                        {isPending && (
                          <Button variant="outline" size="sm" onClick={() => startComment()}>
                            <MessageSquare size={14} />
                            提出意见
                          </Button>
                        )}
                      </div>
                      <p className="adr-meta">
                        {review.unresolved_count}{" "}
                        条修改意见待解决。意见与回复按修订保留；当前工作区使用共享访问权限，不区分评审角色。
                      </p>
                      {!comments.length && (
                        <p className="adr-empty">
                          尚无评审意见。可针对整份提案或具体规则提出问题。
                        </p>
                      )}
                      {comments.map((note) => (
                        <article key={note.id} className="adr-note">
                          <div className="adr-row adr-between adr-wrap">
                            <h3>{note.target?.split(":").slice(1).join(":") ?? "整份提案"}</h3>
                            <span className="adr-pill">
                              {resolved.has(note.id) ? "已解决" : note.blocking ? "需修改" : "讨论"}
                            </span>
                          </div>
                          <p className="adr-meta">
                            {note.id} · {note.adr_id} · {new Date(note.created_at).toLocaleString()}
                          </p>
                          <Markdown>{note.body}</Markdown>
                          {review.events
                            .filter((e) => e.comment_id === note.id)
                            .map((reply) => (
                              <div className="adr-reply" key={reply.id}>
                                <span className="adr-meta">
                                  {reply.kind === "resolve" ? "确认解决" : "回复"} · {reply.adr_id}{" "}
                                  · {new Date(reply.created_at).toLocaleString()}
                                </span>
                                <Markdown>{reply.body}</Markdown>
                              </div>
                            ))}
                          {isPending && (
                            <div className="adr-row">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCompose({ kind: "reply", commentId: note.id });
                                  setError("");
                                }}
                              >
                                回复
                              </Button>
                              {!resolved.has(note.id) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setCompose({ kind: "resolve", commentId: note.id });
                                    setError("");
                                  }}
                                >
                                  <Check size={14} />
                                  确认已解决
                                </Button>
                              )}
                            </div>
                          )}
                        </article>
                      ))}
                    </>
                  )}
                </div>
                <footer className="adr-review-footer">
                  <div>
                    <strong>
                      {isPending
                        ? review.unresolved_count
                          ? `${review.unresolved_count} 条修改意见待解决`
                          : "整份提案一起采纳"
                        : ADR_STATUS_LABEL[adr.status]}
                    </strong>
                    <span>
                      {isPending ? "采纳前将核对账本与评审记录" : "原文与主张来源保持不变"}
                    </span>
                  </div>
                  {isPending && (
                    <div className="adr-row adr-wrap">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setDecision({ status: "rejected", token: review.review_token });
                          setReason("");
                          setError("");
                        }}
                      >
                        否决
                      </Button>
                      <Button variant="outline" onClick={() => onRevise(adr)}>
                        提交修订
                      </Button>
                      <Button
                        disabled={!!review.unresolved_count || query.isFetching}
                        onClick={() => {
                          if (tab !== "preview") {
                            setTab("preview");
                            return;
                          }
                          setDecision({ status: "accepted", token: review.review_token });
                          setError("");
                        }}
                      >
                        {tab === "preview" ? "采纳并生效" : "查看生效预览"} <ArrowRight size={14} />
                      </Button>
                    </div>
                  )}
                </footer>
              </>
            )
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!compose}
        onOpenChange={(value) => {
          if (!value && !add.isPending) setCompose(null);
        }}
      >
        <DialogContent className="adr-dialog">
          <DialogHeader>
            <DialogTitle>
              {compose?.kind === "resolve"
                ? "确认意见已解决"
                : compose?.kind === "reply"
                  ? "回复评审意见"
                  : "提出评审意见"}
            </DialogTitle>
            <DialogDescription>
              {compose?.target ?? compose?.commentId ?? "整份提案"} · 提交后作为评审证据保留
            </DialogDescription>
          </DialogHeader>
          {compose?.kind === "comment" && (
            <label className="adr-check">
              <input
                type="checkbox"
                checked={compose.blocking}
                onChange={(e) => setCompose({ ...compose, blocking: e.target.checked })}
              />
              需修改：解决前不能采纳
            </label>
          )}
          <Label htmlFor="adr-opinion">
            {compose?.kind === "resolve" ? "解决依据" : "具体内容"}
          </Label>
          <Textarea
            id="adr-opinion"
            rows={5}
            value={draft}
            onChange={(e) => setDrafts({ ...drafts, [draftKey]: e.target.value })}
          />
          {error && (
            <p role="alert" className="adr-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={add.isPending} onClick={() => setCompose(null)}>
              稍后继续
            </Button>
            <Button disabled={add.isPending} onClick={() => void saveOpinion()}>
              {add.isPending && <Loader2 size={14} className="animate-spin" />}保存记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!decision}
        onOpenChange={(value) => {
          if (!value && !update.isPending) setDecision(null);
        }}
      >
        <DialogContent className="adr-dialog">
          <DialogHeader>
            <DialogTitle>
              {decision?.status === "accepted" ? "采纳这份提案" : "否决这份提案"}
            </DialogTitle>
            <DialogDescription>
              {adr?.id} · {adr?.title}
            </DialogDescription>
          </DialogHeader>
          <p className="adr-meta">
            {decision?.status === "accepted"
              ? `采纳将改变 ${effectiveDiff.length} 项当前规则。主张来源保持不变。`
              : "否决后不会应用提案中的规则变更。"}
          </p>
          <Label htmlFor="adr-decision-reason">决定理由（必填）</Label>
          <Textarea
            id="adr-decision-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {error && (
            <div role="alert" className="adr-error">
              <p>{error}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setDecision(null);
                  setTab("preview");
                  void query.refetch();
                }}
              >
                返回并重新评审
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={update.isPending} onClick={() => setDecision(null)}>
              返回评审
            </Button>
            <Button disabled={update.isPending} onClick={() => void decide()}>
              {update.isPending && <Loader2 size={14} className="animate-spin" />}确认
              {decision?.status === "accepted" ? "采纳" : "否决"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
