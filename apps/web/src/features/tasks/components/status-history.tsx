"use client";
import { useState } from "react";
import { Button } from "@x-cartographer/ui";
import { useStatusHistory } from "@/lib/api/hooks";
import {
  TASK_STATUS_CONFIG,
  STORY_STATUS_CONFIG,
  type TaskStatus,
  type StoryStatus,
} from "@/types";
export interface StatusHistoryProps {
  entityId: string;
  entityType: "task" | "story" | "adr";
  maxItems?: number;
  collapsible?: boolean;
  showActions?: boolean;
  className?: string;
}
const ledgerLabels: Record<string, string> = {
  "(none)": "未登记",
  constraint_written: "约束已登记",
  ratified: "已追认",
  proposed: "待评审",
  accepted: "已采纳",
  rejected: "已否决",
  deprecated: "已弃用",
  superseded: "已替代",
};
export function StatusHistory({
  entityId,
  entityType,
  maxItems = 10,
  collapsible = false,
  className,
}: StatusHistoryProps) {
  const { data: history = [], isLoading, error, refetch } = useStatusHistory(entityId);
  const [expanded, setExpanded] = useState(!collapsible);
  const [showAll, setShowAll] = useState(false);
  const label = (value: string) =>
    (entityType === "task"
      ? TASK_STATUS_CONFIG[value as TaskStatus]?.label
      : entityType === "story"
        ? STORY_STATUS_CONFIG[value as StoryStatus]?.label
        : undefined) ??
    ledgerLabels[value] ??
    value;
  if (isLoading) return <p className={className}>正在加载状态历史…</p>;
  if (error)
    return (
      <div role="alert">
        历史加载失败
        <Button variant="outline" onClick={() => refetch()}>
          重试
        </Button>
      </div>
    );
  const sorted = [...history].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
  );
  return (
    <section className={className}>
      <h3 className="text-sm font-semibold">状态历史</h3>
      {collapsible && (
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "收起" : "展开"}
        </Button>
      )}
      {expanded &&
        (!sorted.length ? (
          <p className="mt-2 text-sm text-muted-foreground">暂无状态变更记录</p>
        ) : (
          <>
            <ol className="mt-2 space-y-3">
              {(showAll ? sorted : sorted.slice(0, maxItems)).map((record) => (
                <li key={record.id} className="border-l-2 pl-3 text-sm">
                  <p>
                    {label(record.previous_status)} → {label(record.new_status)}
                  </p>
                  {record.reason && (
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {record.reason}
                    </p>
                  )}
                  <time className="text-xs text-muted-foreground" dateTime={record.changed_at}>
                    {new Date(record.changed_at).toLocaleString("zh-CN")}
                  </time>
                </li>
              ))}
            </ol>
            {sorted.length > maxItems && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "收起较早记录" : `查看全部 ${sorted.length} 条记录`}
              </Button>
            )}
          </>
        ))}
    </section>
  );
}
/** Evidence is read-only; correcting status must go through the entity's status endpoint. */
export function StatusHistoryPanel(
  props: Pick<StatusHistoryProps, "entityId" | "entityType" | "className">,
) {
  return <StatusHistory {...props} maxItems={50} />;
}
