import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquare } from "lucide-react";
import type {
  AdrChanges,
  ArchitecturePrinciple,
  CurrentConstitution,
  TechStackEntry,
} from "@x-cartographer/shared";

export type Entry = ArchitecturePrinciple | TechStackEntry;
export type DeltaRow = {
  key: string;
  category: "architecture_principles" | "tech_stack";
  id: string;
  before?: Entry;
  after?: Entry;
};
export function constitutionDiff(
  before: CurrentConstitution,
  after: CurrentConstitution,
): DeltaRow[] {
  return (["architecture_principles", "tech_stack"] as const).flatMap((category) => {
    const a = new Map<string, Entry>(before[category].map((v) => [v.id, v]));
    const b = new Map<string, Entry>(after[category].map((v) => [v.id, v]));
    return [...new Set([...a.keys(), ...b.keys()])]
      .filter((id) => JSON.stringify(a.get(id)) !== JSON.stringify(b.get(id)))
      .map((id) => ({
        key: `${category}:${id}`,
        category,
        id,
        before: a.get(id),
        after: b.get(id),
      }));
  });
}
export function proposalRows(changes?: AdrChanges, base?: CurrentConstitution): DeltaRow[] {
  return (["architecture_principles", "tech_stack"] as const).flatMap((category) => [
    ...(changes?.[category]?.upsert ?? []).map((after) => ({
      key: `${category}:${after.id}`,
      category,
      id: after.id,
      before: base?.[category].find((v) => v.id === after.id),
      after,
    })),
    ...(changes?.[category]?.remove ?? []).map((id) => ({
      key: `${category}:${id}`,
      category,
      id,
      before: base?.[category].find((v) => v.id === id),
    })),
  ]);
}
export function Markdown({ children }: { children: string }) {
  return (
    <div className="adr-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
function EntryText({ entry }: { entry: Entry }) {
  return (
    <>
      <Markdown>{"statement" in entry ? entry.statement : entry.choice}</Markdown>
      {"choice" in entry && (
        <p className="adr-meta">
          {entry.layer}
          {entry.version ? ` · ${entry.version}` : ""}
        </p>
      )}
      {entry.rationale && <p className="adr-meta">依据：{entry.rationale}</p>}
    </>
  );
}
export function ChangeList({
  rows,
  onComment,
  modules = new Map(),
  current = false,
  ruleSources = {},
  onSource,
}: {
  current?: boolean;
  ruleSources?: Record<string, string>;
  onSource?: (id: string) => void;
  rows: DeltaRow[];
  onComment?: (target: string) => void;
  modules?: ReadonlyMap<string, string>;
}) {
  if (!rows.length)
    return (
      <p className="adr-empty">
        {current ? "当前没有生效规则。" : "没有规则变化。这份 ADR 只记录决策依据。"}
      </p>
    );
  return (
    <div className="adr-change-list">
      {rows.map((row) => {
        const entry = row.after ?? row.before;
        return (
          <article className="adr-change" key={row.key}>
            <div className="adr-row adr-between adr-wrap">
              <div className="adr-row">
                <span className="adr-change-tag">
                  {current ? "生效中" : row.after ? (row.before ? "修改" : "新增") : "删除"}
                </span>
                <h3>{"choice" in (entry ?? {}) ? (entry as TechStackEntry).choice : row.id}</h3>
              </div>
              {entry && "strength" in entry && <span className="adr-meta">{entry.strength}</span>}
            </div>
            {row.before && row.after ? (
              <div className="adr-diff">
                <div>
                  <span className="adr-meta">变更前</span>
                  <EntryText entry={row.before} />
                </div>
                <div>
                  <span className="adr-meta">变更后</span>
                  <EntryText entry={row.after} />
                </div>
              </div>
            ) : entry ? (
              <div className="adr-statement">
                <EntryText entry={entry} />
              </div>
            ) : (
              <p className="adr-statement">显式移除 {row.id}；对比基线中不存在此条目。</p>
            )}
            <div className="adr-row adr-between adr-wrap">
              <span className="adr-meta">
                {entry && "statement" in entry
                  ? entry.module_ids?.length
                    ? `适用：${entry.module_ids.map((m) => modules.get(m) ?? m).join("、")}`
                    : "适用：全局"
                  : row.id}
              </span>
              {current && ruleSources[`${row.category}:${row.id}`] && (
                <button
                  type="button"
                  className="adr-text-action"
                  onClick={() => onSource?.(ruleSources[`${row.category}:${row.id}`])}
                >
                  来源 {ruleSources[`${row.category}:${row.id}`]}
                </button>
              )}
              {onComment && (
                <button
                  type="button"
                  className="adr-text-action"
                  onClick={() => onComment(row.key)}
                >
                  <MessageSquare size={14} />
                  提出意见
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
