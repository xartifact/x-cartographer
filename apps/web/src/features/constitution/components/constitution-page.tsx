'use client';

/**
 * 技术宪法主页面（单例文档 → 独立页面，technical-constitution.md §7 / P1）。
 *
 * 展示 `getCurrentConstitution` 的**折叠结果**（不是 ADR 原始账本）：当前生效的
 * 架构原则（含 RFC 2119 强制力徽章）/ 技术栈 / 模块目录，外加发起新 ADR 的入口。
 *
 * 为什么页面与「ADR 历史」分开（TASK-376）：本页回答"现在该遵守什么"（单例文档），
 * ADR 历史回答"这是谁什么时候定的"（集合记录 → Sheet）。两者不是同一份数据的两种排版，
 * 而是两个问题——混在一屏会让"当前态"和"决策流水"互相稀释。
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2, Package, Plus, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@x-cartographer/ui';
import type { AdrRecord, CreateAdrRecordDTO, Product } from '@x-cartographer/shared';
import {
  useAdrRecords,
  useCreateAdrRecord,
  useCurrentConstitution,
} from '@/lib/api/hooks';
import { AdrCreateDialog } from './adr-create-dialog';
import { AdrRevisionSheet, ADR_STATUS_LABEL } from './adr-revision-sheet';
import { useMilestonesByProduct } from '@/lib/api/hooks';

interface ConstitutionPageProps {
  project: Product;
}

/** 强制力徽章配色：MUST/MUST_NOT 是硬约束，SHOULD/MAY 是软约束 */
const STRENGTH_STYLE: Record<string, string> = {
  MUST: 'bg-destructive/10 text-destructive border-destructive/30',
  MUST_NOT: 'bg-destructive/10 text-destructive border-destructive/30',
  SHOULD: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  MAY: 'bg-muted text-muted-foreground',
};

export function ConstitutionPage({ project }: ConstitutionPageProps) {
  const productId = project.id;
  const { data: constitution, isLoading, error } = useCurrentConstitution(productId);
  const { data: adrs = [] } = useAdrRecords(productId);
  const { data: milestones = [] } = useMilestonesByProduct(productId);
  /** 里程碑 id → 名称（时间线上的锚点显示"v0.2"而不是裸 MS-011） */
  const milestoneNames = useMemo(
    () => new Map(milestones.map((m) => [m.id, m.name])),
    [milestones]
  );
  const createAdr = useCreateAdrRecord();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedAdr, setSelectedAdr] = useState<AdrRecord | null>(null);

  const principles = constitution?.architecture_principles ?? [];
  const techStack = constitution?.tech_stack ?? [];
  const modules = constitution?.modules ?? [];

  /** 按 seq 排序的账本（时间线顺序，§3.3 seq 是折叠排序的权威依据） */
  const adrTimeline = useMemo(
    () => [...adrs].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)),
    [adrs]
  );

  async function handleSubmit(dto: CreateAdrRecordDTO): Promise<boolean> {
    setSubmitError(null);
    try {
      const result = (await createAdr.mutateAsync(dto)) as { id?: string; status?: string };
      toast.success('ADR 已创建', {
        description:
          result?.status === 'proposed'
            ? dto.provenance && dto.provenance !== 'human_asserted'
              ? `${result.id} 落为 proposed——非人主张的高影响写入不自动生效，需显式升格（adr status … accepted --reason）`
              : `${result.id} 落为 proposed（未指定 status 时的默认落点）——确认后执行 adr status … accepted --reason 使其生效`
            : `${result?.id ?? ''}（${result?.status ?? 'accepted'}）`,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setSubmitError(message);
      toast.error('创建 ADR 失败', { description: message });
      return false;
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载技术宪法…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-destructive">
        加载技术宪法失败：{error instanceof Error ? error.message : '未知错误'}
      </div>
    );
  }

  const isEmpty = principles.length === 0 && techStack.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">技术宪法</h2>
          <p className="text-sm text-muted-foreground">
            当前生效的架构约束（由 accepted 的 ADR 折叠而来）。原则是信息注入，不拦截任务流转。
          </p>
        </div>
        <Button onClick={() => { setSubmitError(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          发起新 ADR
        </Button>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center px-8 text-center text-sm text-muted-foreground">
            宪法尚未建立——尚无任何 accepted 的 ADR 引入架构原则或技术栈。
            <br />
            用「发起新 ADR」记录第一条架构决策。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 架构原则 */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4" />
                架构原则（{principles.length}）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {principles.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚无架构原则。</p>
              ) : (
                principles.map((p) => (
                  <div key={p.id} className="flex items-start gap-3 rounded-md border p-3">
                    <Badge variant="outline" className={STRENGTH_STYLE[p.strength] ?? ''}>
                      {p.strength}
                    </Badge>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm">{p.statement}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{p.id}</span>
                        {p.module_ids?.length ? (
                          <span>
                            生效范围：
                            {p.module_ids.map((m) => (
                              <span key={m} className="ml-1 font-mono">{m}</span>
                            ))}
                          </span>
                        ) : (
                          <span>全局生效</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* 技术栈 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4" />
                技术栈（{techStack.length}）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {techStack.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚无技术栈选型。</p>
              ) : (
                techStack.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>
                      <span className="font-medium">{t.choice}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{t.layer}</span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {t.version ?? ''} {t.id}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* 模块目录（只读摘要——编辑在「模块」页） */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">模块目录（{modules.length}）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {modules.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚无模块。</p>
              ) : (
                modules.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{m.id}</span>
                    <span>{m.name}</span>
                  </div>
                ))
              )}
              <p className="pt-1 text-xs text-muted-foreground">
                模块定义只在模块目录维护（本页只读）——ADR 不再定义模块。
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ADR 演进时间线（按 seq；点击看详情 Sheet） */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            ADR 演进历史（{adrTimeline.length}）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {adrTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚无 ADR 记录。</p>
          ) : (
            <ol className="relative space-y-3 border-l pl-6">
              {adrTimeline.map((adr) => {
                // supersedes 指向账本里已存在的记录时，画一条虚线连到被替代者（§5）：
                // 指向不存在的 id（外部/历史遗留）时只显示文字，不画悬空连线
                const supersededExists = !!adr.supersedes && adrTimeline.some((a) => a.id === adr.supersedes);
                return (
                  <li key={adr.id} className="relative">
                    {/* 时间轴节点：被替代的记录用空心点，仍生效的用实心点 */}
                    <span
                      className={
                        adr.status === 'superseded' || adr.status === 'deprecated'
                          ? 'absolute -left-[27px] top-1.5 h-2 w-2 rounded-full border border-muted-foreground/50 bg-card'
                          : 'absolute -left-[27px] top-1.5 h-2 w-2 rounded-full bg-primary'
                      }
                    />
                    {adr.milestone_id && (
                      /* 里程碑锚点标记（§5：叠加在轴上的"这是 vX 发布时的架构状态"） */
                      <span
                        className="absolute -left-[34px] top-1 h-4 w-4 rounded-sm border border-primary/40 bg-primary/10"
                        title={`锚定里程碑 ${milestoneNames.get(adr.milestone_id) ?? adr.milestone_id}`}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedAdr(adr)}
                      className="w-full rounded-md border p-2 text-left transition-colors hover:bg-accent/40"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{adr.id}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {ADR_STATUS_LABEL[adr.status] ?? adr.status}
                        </Badge>
                        {adr.supersedes && (
                          <span
                            className={
                              supersededExists
                                ? 'border-b border-dashed border-muted-foreground/60 text-xs text-muted-foreground'
                                : 'text-xs text-muted-foreground'
                            }
                            title={supersededExists ? '替代了账本中的一条记录' : '被替代的记录不在当前账本中'}
                          >
                            替代 {adr.supersedes}
                          </span>
                        )}
                        {adr.milestone_id && (
                          <span className="text-xs text-muted-foreground">
                            锚定 {milestoneNames.get(adr.milestone_id) ?? adr.milestone_id}
                          </span>
                        )}
                      </div>
                      <div className="text-sm">{adr.title}</div>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* ADR 详情 Sheet（集合里一条记录的详情 → Sheet，P1） */}
      <AdrRevisionSheet
        adr={selectedAdr}
        onOpenChange={(open) => { if (!open) setSelectedAdr(null); }}
        milestoneNames={milestoneNames}
      />

      <AdrCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productId={productId}
        onSubmit={handleSubmit}
        submitError={submitError}
      />
    </div>
  );
}
