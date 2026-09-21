'use client';

/**
 * 单条 ADR 详情 Sheet —— technical-constitution.md §7 / P1：
 * 「某一次 ADR」是集合里的一条记录，用 Sheet（对齐 TaskDetailSheet 惯例）；
 * 「当前生效宪法」是单例文档，用页面。两者不是同一份数据的两种排版。
 *
 * 展示 context/decision/consequences/alternatives_considered/changes/status/关联 milestone。
 * `changes` 原样以 JSON 呈现：它是**差异**（不是全量快照），格式化成表格反而会
 * 暗示"这是当前状态"——§3.2 明确 changes 只记差异。
 */

import {
  Badge,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@x-cartographer/ui';
import type { AdrRecord } from '@x-cartographer/shared';

/** ADR 状态中文标签（与页面共用同一份映射语义） */
export const ADR_STATUS_LABEL: Record<string, string> = {
  proposed: '提议中',
  accepted: '已采纳',
  rejected: '已否决',
  deprecated: '已废弃',
  superseded: '被替代',
};

export interface AdrRevisionSheetProps {
  adr: AdrRecord | null;
  onOpenChange: (open: boolean) => void;
  /** 里程碑名称映射（显示"锚定 v0.2"而不是裸 id；缺省时回落显示 id） */
  milestoneNames?: ReadonlyMap<string, string>;
}

export function AdrRevisionSheet({ adr, onOpenChange, milestoneNames }: AdrRevisionSheetProps) {
  const milestoneLabel = (id: string) => milestoneNames?.get(id) ?? id;

  return (
    <Sheet open={!!adr} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {adr && (
          <>
            <SheetHeader>
              <SheetTitle>{adr.title}</SheetTitle>
              <SheetDescription>
                {adr.id} · {ADR_STATUS_LABEL[adr.status] ?? adr.status}
                {adr.milestone_id ? ` · 锚定 ${milestoneLabel(adr.milestone_id)}` : ''}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 py-4 text-sm">
              <section>
                <h4 className="mb-1 font-medium">背景</h4>
                <p className="whitespace-pre-wrap text-muted-foreground">{adr.context}</p>
              </section>
              <section>
                <h4 className="mb-1 font-medium">决策</h4>
                <p className="whitespace-pre-wrap">{adr.decision}</p>
              </section>
              {adr.consequences && (
                <section>
                  <h4 className="mb-1 font-medium">后果</h4>
                  <p className="whitespace-pre-wrap text-muted-foreground">{adr.consequences}</p>
                </section>
              )}
              {adr.alternatives_considered && (
                <section>
                  <h4 className="mb-1 font-medium">被否的替代方案</h4>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {adr.alternatives_considered}
                  </p>
                </section>
              )}
              {adr.module_ids?.length ? (
                <section>
                  <h4 className="mb-1 font-medium">涉及模块</h4>
                  <div className="flex flex-wrap gap-1">
                    {adr.module_ids.map((m) => (
                      <Badge key={m} variant="outline" className="font-mono text-[11px]">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </section>
              ) : null}
              {adr.changes && (
                <section>
                  <h4 className="mb-1 font-medium">状态变更（changes）</h4>
                  <p className="mb-1 text-xs text-muted-foreground">
                    差异记录，非全量快照——折叠后才得到当时的生效状态。
                  </p>
                  <pre className="overflow-x-auto rounded-md border bg-muted/30 p-2 text-xs">
                    {JSON.stringify(adr.changes, null, 2)}
                  </pre>
                </section>
              )}
              <section className="space-y-0.5 text-xs text-muted-foreground">
                <p>主张来源：{adr.provenance}</p>
                {adr.supersedes && <p>替代：{adr.supersedes}</p>}
                <p>创建：{adr.created_at?.slice(0, 19).replace('T', ' ')}</p>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
