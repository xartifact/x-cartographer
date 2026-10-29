"use client";
import { useNavigate } from "@tanstack/react-router";

import { Input } from "@x-cartographer/ui";
import { useUrlState } from "@/lib/hooks/use-url-state";

import { useMemo, useState } from "react";
import { ArrowRight, GitBranch, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@x-cartographer/ui";
import type { AdrRecord, CreateAdrRecordDTO, Product } from "@x-cartographer/shared";
import {
  useAdrRecords,
  useCreateAdrRecord,
  useCurrentConstitution,
  useMilestonesByProduct,
} from "@/lib/api/hooks";
import { AdrCreateDialog } from "./adr-create-dialog";
import { AdrRevisionSheet, ADR_STATUS_LABEL } from "./adr-revision-sheet";
import { ChangeList, proposalRows } from "./adr-changes";
import "./constitution.css";

export function ConstitutionPage({ project }: { project: Product }) {
  const navigate = useNavigate();
  const current = useCurrentConstitution(project.id);
  const records = useAdrRecords(project.id);
  const { data: milestones = [] } = useMilestonesByProduct(project.id);
  const create = useCreateAdrRecord();
  const [view, setView] = useState<"queue" | "current" | "history">("queue");
  const [selected, setSelected] = useUrlState("adrId");
  const [search, setSearch] = useUrlState("q");
  const [moduleFilter, setModuleFilter] = useUrlState("module");
  const [statusFilter, setStatusFilter] = useUrlState("status");
  const [creating, setCreating] = useState(false);
  const [revision, setRevision] = useState<AdrRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const milestoneNames = useMemo(
    () => new Map(milestones.map((m) => [m.id, m.name])),
    [milestones],
  );
  const modules = useMemo(
    () => new Map((current.data?.modules ?? []).map((m) => [m.id, m.name])),
    [current.data],
  );
  const filteredRecords = (records.data ?? []).filter(
    (r) =>
      `${r.id} ${r.title}`.toLowerCase().includes(search.toLowerCase()) &&
      (!moduleFilter || r.module_ids?.includes(moduleFilter)) &&
      (!statusFilter || r.status === statusFilter),
  );
  const pending = filteredRecords.filter((r) => r.status === "proposed" && !r.revised_by);
  async function submit(dto: CreateAdrRecordDTO) {
    setError(null);
    try {
      const result = await create.mutateAsync(dto);
      toast.success("提案已提交评审");
      setSelected(result.id);
      setView("queue");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
      return false;
    }
  }
  if (current.isLoading || records.isLoading)
    return (
      <div className="flex items-center gap-2 p-8">
        <Loader2 className="animate-spin" size={16} />
        加载技术宪法…
      </div>
    );
  if (current.error || records.error)
    return (
      <div role="alert" className="space-y-3 p-8">
        <p>加载失败：{(current.error ?? records.error)?.message}</p>
        <Button
          variant="outline"
          onClick={() => {
            void current.refetch();
            void records.refetch();
          }}
        >
          重新加载
        </Button>
      </div>
    );
  const constitution = current.data;
  return (
    <div className="adr-workspace">
      <header className="adr-page-heading">
        <div>
          <span className="adr-eyebrow">ARCHITECTURE DECISIONS</span>
          <h1>技术宪法</h1>
          <p>理解变化，讨论取舍，让决定有据可循。</p>
        </div>
        <Button
          onClick={() => {
            setRevision(null);
            setError(null);
            setCreating(true);
          }}
        >
          <Plus size={16} />
          发起提案
        </Button>
      </header>
      <nav className="adr-tabs" aria-label="技术宪法视图">
        {(
          [
            ["queue", "待评审"],
            ["current", "当前规则"],
            ["history", "决策历史"],
          ] as const
        ).map(([key, name]) => (
          <button
            type="button"
            key={key}
            className={view === key ? "selected" : ""}
            aria-current={view === key ? "page" : undefined}
            onClick={() => setView(key)}
          >
            {name}
            {key === "queue" && <span className="adr-count">{pending.length}</span>}
          </button>
        ))}
      </nav>
      {view !== "current" && (
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-full sm:w-72"
            aria-label="搜索提案"
            placeholder="搜索标题或 ADR ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="筛选模块"
            className="rounded border bg-background px-2"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            <option value="">所有模块</option>
            {[...modules].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="筛选状态"
            className="rounded border bg-background px-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">所有状态</option>
            {Object.entries(ADR_STATUS_LABEL).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          {(search || moduleFilter || statusFilter) && (
            <Button
              variant="ghost"
              onClick={() => {
                void navigate({ search: { adrId: selected || undefined } } as never);
              }}
            >
              清除筛选
            </Button>
          )}
        </div>
      )}
      {view === "queue" && (
        <>
          <div className="adr-section-heading">
            <h2>需要作出的决定</h2>
            <span className="adr-meta">{pending.length} 条待评审提案</span>
          </div>
          {pending.length ? (
            <div className="adr-proposals">
              {pending.map((adr) => {
                const changes = proposalRows(adr.changes, constitution ?? undefined);
                const added = changes.filter((r) => r.after && !r.before).length;
                const modified = changes.filter((r) => r.after && r.before).length;
                const removed = changes.filter((r) => !r.after).length;
                return (
                  <button className="adr-proposal" key={adr.id} onClick={() => setSelected(adr.id)}>
                    <div className="adr-proposal-icon">
                      <GitBranch size={22} />
                    </div>
                    <div className="adr-proposal-main">
                      <div className="adr-row adr-wrap">
                        <span className="adr-meta">{adr.id}</span>
                        <span className="adr-pill">待评审</span>
                        <span className="adr-meta">
                          {adr.provenance === "agent_inferred"
                            ? "Agent 推断"
                            : adr.provenance === "imported"
                              ? "外部导入"
                              : "人直接主张"}
                        </span>
                      </div>
                      <h2>{adr.title}</h2>
                      <p className="line-clamp-2">{adr.decision}</p>
                      <div className="adr-facts">
                        <span>
                          {added} 项新增 · {modified} 项修改 · {removed} 项删除
                        </span>
                        {adr.revises && <span>修订自 {adr.revises}</span>}
                        <span>{new Date(adr.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ArrowRight size={18} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="adr-empty">
              <ShieldCheck size={28} />
              <h2>没有待评审提案</h2>
              <p>可以查看当前规则，或发起一份新的架构提案。</p>
            </div>
          )}
        </>
      )}
      {view === "current" && (
        <>
          <div className="adr-section-heading">
            <h2>架构原则 · {constitution?.architecture_principles.length ?? 0}</h2>
            <span className="adr-meta">当前生效的账本投影</span>
          </div>
          {constitution?.architecture_principles.length ? (
            <ChangeList
              current
              ruleSources={constitution?.rule_sources}
              onSource={setSelected}
              modules={modules}
              rows={constitution.architecture_principles.map((p) => ({
                key: p.id,
                id: p.id,
                category: "architecture_principles",
                after: p,
              }))}
            />
          ) : (
            <p className="adr-empty">尚无生效的架构原则。待评审提案不会提前进入当前规则。</p>
          )}
          <div className="adr-section-heading">
            <h2>技术栈 · {constitution?.tech_stack.length ?? 0}</h2>
          </div>
          <ChangeList
            current
            ruleSources={constitution?.rule_sources}
            onSource={setSelected}
            rows={(constitution?.tech_stack ?? []).map((t) => ({
              key: t.id,
              id: t.id,
              category: "tech_stack",
              after: t,
            }))}
          />
          <div className="adr-section-heading">
            <h2>模块目录 · {modules.size}</h2>
            <span className="adr-meta">模块在模块目录中独立维护</span>
          </div>
          <div className="adr-module-list">
            {[...modules].map(([id, name]) => (
              <span key={id}>
                {name} <code>{id}</code>
              </span>
            ))}
          </div>
        </>
      )}
      {view === "history" && (
        <>
          <div className="adr-section-heading">
            <h2>决策与修订记录</h2>
            <span className="adr-meta">保留所有提案与原始主张</span>
          </div>
          {[...filteredRecords].reverse().map((adr) => (
            <button className="adr-history-row" key={adr.id} onClick={() => setSelected(adr.id)}>
              <span className="adr-meta">{adr.id}</span>
              <span className="adr-pill">
                {adr.revised_by ? "已有新修订" : ADR_STATUS_LABEL[adr.status]}
              </span>
              <strong>{adr.title}</strong>
              <span className="adr-meta">
                {adr.revised_by
                  ? `新版 ${adr.revised_by}`
                  : new Date(adr.created_at).toLocaleDateString()}
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
          {!records.data?.length && <p className="adr-empty">尚无决策记录。</p>}
        </>
      )}
      <AdrRevisionSheet
        key={selected ?? "closed"}
        id={selected}
        onClose={() => setSelected(null)}
        onSelect={setSelected}
        modules={modules}
        milestoneNames={milestoneNames}
        onRevise={(adr) => {
          setRevision(adr);
          setError(null);
          setCreating(true);
        }}
        onDecided={(status) => {
          setView(status === "accepted" ? "current" : "history");
          setSelected(null);
        }}
      />
      <AdrCreateDialog
        open={creating}
        onOpenChange={setCreating}
        initial={revision}
        productId={project.id}
        onSubmit={submit}
        submitError={error}
      />
    </div>
  );
}
