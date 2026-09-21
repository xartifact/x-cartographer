'use client';

/**
 * 发起新 ADR 对话框（技术宪法页面入口）—— technical-constitution.md §7。
 *
 * changes 用 repeatable-row 编辑器（参照 task-detail-sheet 的依赖编辑器思路）：
 * 每行 = 一条 upsert 条目，按类别分组（tech_stack / architecture_principles）。
 * **modules 一类刻意不提供**：模块定义自 0006 起只在 `system_modules` 表（§6.4），
 * 写进 ADR changes 会造出第二份真相——模块目录用「模块」页维护。
 *
 * 提交后不假设已生效：非人主张（provenance 默认 agent_inferred）的高影响写入由服务端
 * 落 `proposed`，需要显式 `accepted`（§4.4 状态机即权限模型）。故表单里 provenance
 * 由用户显式选择，UI 不替服务端做落点判断。
 */

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@x-cartographer/ui';
import type { ArchitecturePrinciple, CreateAdrRecordDTO, PrincipleStrength, TechStackEntry } from '@x-cartographer/shared';

interface AdrCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  /** 提交；返回 false 表示失败（对话框保持打开并显示错误） */
  onSubmit: (dto: CreateAdrRecordDTO) => Promise<boolean>;
  submitError: string | null;
}

/** 原则草稿行（strength 默认 SHOULD——MUST 应当是深思后的选择） */
interface PrincipleRow {
  id: string;
  strength: PrincipleStrength;
  statement: string;
  module_ids: string;
}

/** 技术栈草稿行 */
interface TechRow {
  id: string;
  layer: string;
  choice: string;
  version: string;
  rationale: string;
}

const EMPTY_PRINCIPLE: PrincipleRow = { id: '', strength: 'SHOULD', statement: '', module_ids: '' };
const EMPTY_TECH: TechRow = { id: '', layer: '', choice: '', version: '', rationale: '' };

export function AdrCreateDialog({
  open,
  onOpenChange,
  productId,
  onSubmit,
  submitError,
}: AdrCreateDialogProps) {
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [decision, setDecision] = useState('');
  const [consequences, setConsequences] = useState('');
  const [alternatives, setAlternatives] = useState('');
  const [provenance, setProvenance] = useState<'human_asserted' | 'agent_inferred' | 'imported'>('human_asserted');
  const [principles, setPrinciples] = useState<PrincipleRow[]>([]);
  const [techs, setTechs] = useState<TechRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setContext('');
    setDecision('');
    setConsequences('');
    setAlternatives('');
    setProvenance('human_asserted');
    setPrinciples([]);
    setTechs([]);
    setLocalError(null);
  }, [open]);

  const splitList = (value: string) =>
    value.split(',').map((s) => s.trim()).filter(Boolean);

  async function handleSubmit() {
    setLocalError(null);
    if (!title.trim() || !context.trim() || !decision.trim()) {
      setLocalError('title / context / decision 均为必填——ADR 的价值在于"为什么这么定"可追溯。');
      return;
    }

    const upsertPrinciples = principles
      .filter((p) => p.id.trim() && p.statement.trim())
      .map((p) => {
        const entry: ArchitecturePrinciple = {
          id: p.id.trim(),
          strength: p.strength,
          statement: p.statement.trim(),
        };
        const modules = splitList(p.module_ids);
        if (modules.length) entry.module_ids = modules;
        return entry;
      });
    const upsertTechs = techs
      .filter((t) => t.id.trim() && t.choice.trim())
      .map((t) => {
        const entry: TechStackEntry = { id: t.id.trim(), layer: t.layer.trim(), choice: t.choice.trim() };
        if (t.version.trim()) entry.version = t.version.trim();
        if (t.rationale.trim()) entry.rationale = t.rationale.trim();
        return entry;
      });

    const dto: CreateAdrRecordDTO = {
      product_id: productId,
      title: title.trim(),
      context: context.trim(),
      decision: decision.trim(),
      provenance,
      // §7：UI 表单提交的 ADR 默认 accepted。人主张走「立即生效」（§4.1 第一行）；
      // 非人主张**不代填** status——留给服务端按分类器落 proposed，UI 不替服务端做落点判断。
      ...(provenance === 'human_asserted' ? { status: 'accepted' as const } : {}),
    };
    if (consequences.trim()) dto.consequences = consequences.trim();
    if (alternatives.trim()) dto.alternatives_considered = alternatives.trim();
    if (upsertPrinciples.length || upsertTechs.length) {
      dto.changes = {
        ...(upsertTechs.length ? { tech_stack: { upsert: upsertTechs } } : {}),
        ...(upsertPrinciples.length ? { architecture_principles: { upsert: upsertPrinciples } } : {}),
      };
    }

    setSaving(true);
    try {
      if (await onSubmit(dto)) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const error = localError ?? submitError;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>发起新 ADR</DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto py-2">
          <div className="space-y-1.5">
            <Label htmlFor="adr-title">标题 <span className="text-destructive">*</span></Label>
            <Input id="adr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：网关不得引入 LLM 依赖" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adr-context">背景（为什么需要这次决策） <span className="text-destructive">*</span></Label>
            <Textarea id="adr-context" value={context} onChange={(e) => setContext(e.target.value)} rows={3} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adr-decision">决策（定了什么） <span className="text-destructive">*</span></Label>
            <Textarea id="adr-decision" value={decision} onChange={(e) => setDecision(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adr-consequences">后果（可选）</Label>
              <Textarea id="adr-consequences" value={consequences} onChange={(e) => setConsequences(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adr-alternatives">被否的替代方案（可选）</Label>
              <Textarea id="adr-alternatives" value={alternatives} onChange={(e) => setAlternatives(e.target.value)} rows={2} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adr-provenance">主张来源</Label>
            <select
              id="adr-provenance"
              value={provenance}
              onChange={(e) => setProvenance(e.target.value as typeof provenance)}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="human_asserted">human_asserted —— 人直接主张（立即生效）</option>
              <option value="agent_inferred">agent_inferred —— Agent 推断（高影响写入落 proposed）</option>
              <option value="imported">imported —— 外部导入（同上）</option>
            </select>
          </div>

          {/* 架构原则行编辑器 */}
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>架构原则（可选）</Label>
              <Button size="sm" variant="outline" onClick={() => setPrinciples((p) => [...p, { ...EMPTY_PRINCIPLE }])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> 加一条
              </Button>
            </div>
            {principles.length === 0 && (
              <p className="text-xs text-muted-foreground">
                不改变架构约束的决策（如"评估后决定不做"）可以不带原则——只填 title/context/decision 即可。
              </p>
            )}
            {principles.map((row, i) => (
              <div key={i} className="space-y-1.5 rounded border bg-muted/20 p-2">
                <div className="flex gap-2">
                  <Input
                    className="font-mono"
                    placeholder="原则 id（slug，如 deep-tree-fetch）"
                    value={row.id}
                    onChange={(e) => setPrinciples((p) => p.map((r, j) => (j === i ? { ...r, id: e.target.value } : r)))}
                  />
                  <select
                    value={row.strength}
                    onChange={(e) => setPrinciples((p) => p.map((r, j) => (j === i ? { ...r, strength: e.target.value as PrincipleStrength } : r)))}
                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  >
                    <option value="MUST">MUST</option>
                    <option value="SHOULD">SHOULD</option>
                    <option value="MAY">MAY</option>
                    <option value="MUST_NOT">MUST_NOT</option>
                  </select>
                  <Button size="sm" variant="ghost" onClick={() => setPrinciples((p) => p.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea
                  placeholder="EARS 句式：当 <触发/条件>，<主体> 应当 <行为>"
                  rows={2}
                  value={row.statement}
                  onChange={(e) => setPrinciples((p) => p.map((r, j) => (j === i ? { ...r, statement: e.target.value } : r)))}
                />
                <Input
                  className="font-mono"
                  placeholder="生效模块（逗号分隔；留空 = 全局生效）"
                  value={row.module_ids}
                  onChange={(e) => setPrinciples((p) => p.map((r, j) => (j === i ? { ...r, module_ids: e.target.value } : r)))}
                />
              </div>
            ))}
          </div>

          {/* 技术栈行编辑器 */}
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>技术栈（可选）</Label>
              <Button size="sm" variant="outline" onClick={() => setTechs((t) => [...t, { ...EMPTY_TECH }])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> 加一条
              </Button>
            </div>
            {techs.map((row, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  className="font-mono"
                  placeholder="id"
                  value={row.id}
                  onChange={(e) => setTechs((t) => t.map((r, j) => (j === i ? { ...r, id: e.target.value } : r)))}
                />
                <Input
                  placeholder="layer"
                  value={row.layer}
                  onChange={(e) => setTechs((t) => t.map((r, j) => (j === i ? { ...r, layer: e.target.value } : r)))}
                />
                <Input
                  placeholder="choice"
                  value={row.choice}
                  onChange={(e) => setTechs((t) => t.map((r, j) => (j === i ? { ...r, choice: e.target.value } : r)))}
                />
                <Input
                  placeholder="version"
                  value={row.version}
                  onChange={(e) => setTechs((t) => t.map((r, j) => (j === i ? { ...r, version: e.target.value } : r)))}
                />
                <Button size="sm" variant="ghost" onClick={() => setTechs((t) => t.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
