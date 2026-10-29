"use client";
import { ModulePicker } from "@/components/common/module-picker";
import { useCurrentConstitution } from "@/lib/api/hooks";
import { useFormDraft } from "@/lib/hooks/use-form-draft";

/** New proposals and immutable revisions always enter human review. */

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
} from "@x-cartographer/ui";
import type {
  AdrRecord,
  ArchitecturePrinciple,
  CreateAdrRecordDTO,
  PrincipleStrength,
  TechStackEntry,
} from "@x-cartographer/shared";

interface AdrCreateDialogProps {
  initial?: AdrRecord | null;
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
  rationale: string;
}

/** 技术栈草稿行 */
interface TechRow {
  id: string;
  layer: string;
  choice: string;
  version: string;
  rationale: string;
}

const EMPTY_PRINCIPLE: PrincipleRow = {
  id: "",
  strength: "SHOULD",
  statement: "",
  module_ids: "",
  rationale: "",
};
const EMPTY_TECH: TechRow = { id: "", layer: "", choice: "", version: "", rationale: "" };

export function AdrCreateDialog({
  initial,
  open,
  onOpenChange,
  productId,
  onSubmit,
  submitError,
}: AdrCreateDialogProps) {
  const { data: currentRules } = useCurrentConstitution(productId);
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [ruleQuery, setRuleQuery] = useState("");
  const [removedPrinciples, setRemovedPrinciples] = useState("");
  const [removedTechs, setRemovedTechs] = useState("");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [decision, setDecision] = useState("");
  const [consequences, setConsequences] = useState("");
  const [alternatives, setAlternatives] = useState("");
  const [provenance, setProvenance] = useState<"human_asserted" | "agent_inferred" | "imported">(
    "human_asserted",
  );
  const [principles, setPrinciples] = useState<PrincipleRow[]>([]);
  const [techs, setTechs] = useState<TechRow[]>([]);
  const [saving, setSaving] = useState(false);
  const formDraft = useFormDraft({
    open,
    scope: `adr:${productId}:${initial?.id ?? "new"}`,
    values: {
      moduleIds,
      removedPrinciples,
      removedTechs,
      title,
      context,
      decision,
      consequences,
      alternatives,
      provenance,
      principles,
      techs,
    },
    restore: (v) => {
      setModuleIds(v.moduleIds);
      setRemovedPrinciples(v.removedPrinciples);
      setRemovedTechs(v.removedTechs);
      setTitle(v.title);
      setContext(v.context);
      setDecision(v.decision);
      setConsequences(v.consequences);
      setAlternatives(v.alternatives);
      setProvenance(v.provenance);
      setPrinciples(v.principles);
      setTechs(v.techs);
    },
    close: () => onOpenChange(false),
    saving,
    version: initial?.created_at,
  });
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setModuleIds(initial?.module_ids ?? []);
    setTitle(initial?.title ?? "");
    setContext(initial?.context ?? "");
    setDecision(initial?.decision ?? "");
    setConsequences(initial?.consequences ?? "");
    setAlternatives(initial?.alternatives_considered ?? "");
    setProvenance(initial?.provenance ?? "human_asserted");
    setPrinciples(
      (initial?.changes?.architecture_principles?.upsert ?? []).map((p) => ({
        ...p,
        module_ids: p.module_ids?.join(", ") ?? "",
        rationale: p.rationale ?? "",
      })),
    );
    setTechs(
      (initial?.changes?.tech_stack?.upsert ?? []).map((t) => ({
        ...t,
        version: t.version ?? "",
        rationale: t.rationale ?? "",
      })),
    );
    setRemovedPrinciples(initial?.changes?.architecture_principles?.remove?.join(", ") ?? "");
    setRemovedTechs(initial?.changes?.tech_stack?.remove?.join(", ") ?? "");
    setLocalError(null);
  }, [open, initial]);

  const splitList = (value: string) =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  async function handleSubmit() {
    setLocalError(null);
    if (!title.trim() || !context.trim() || !decision.trim()) {
      setLocalError("请填写标题、背景和决策，说明为什么需要这次决定。");
      return;
    }

    if (
      principles.some((p) => !p.id.trim() || !p.statement.trim()) ||
      techs.some((t) => !t.id.trim() || !t.layer.trim() || !t.choice.trim())
    ) {
      setLocalError("请完整填写每一条规则，或删除空白行。");
      return;
    }
    for (const ids of [
      [...principles.map((p) => p.id.trim()), ...splitList(removedPrinciples)],
      [...techs.map((t) => t.id.trim()), ...splitList(removedTechs)],
    ]) {
      if (new Set(ids).size !== ids.length) {
        setLocalError("同一类别的规则 ID 不能重复，也不能同时写入与删除。");
        return;
      }
    }
    const upsertPrinciples = principles
      .filter((p) => p.id.trim() && p.statement.trim())
      .map((p) => {
        const entry: ArchitecturePrinciple = {
          id: p.id.trim(),
          strength: p.strength,
          statement: p.statement.trim(),
        };
        if (p.rationale.trim()) entry.rationale = p.rationale.trim();
        const modules = splitList(p.module_ids);
        if (modules.length) entry.module_ids = modules;
        return entry;
      });
    const upsertTechs = techs
      .filter((t) => t.id.trim() && t.choice.trim())
      .map((t) => {
        const entry: TechStackEntry = {
          id: t.id.trim(),
          layer: t.layer.trim(),
          choice: t.choice.trim(),
        };
        if (t.version.trim()) entry.version = t.version.trim();
        if (t.rationale.trim()) entry.rationale = t.rationale.trim();
        return entry;
      });

    const dto: CreateAdrRecordDTO = {
      product_id: productId,
      module_ids: moduleIds,
      title: title.trim(),
      context: context.trim(),
      decision: decision.trim(),
      provenance,
      status: "proposed",
      ...(initial
        ? {
            revises: initial.id,
            supersedes: initial.supersedes,
            milestone_id: initial.milestone_id,
          }
        : {}),
    };
    if (consequences.trim()) dto.consequences = consequences.trim();
    if (alternatives.trim()) dto.alternatives_considered = alternatives.trim();
    dto.changes = {
      architecture_principles: { upsert: upsertPrinciples, remove: splitList(removedPrinciples) },
      tech_stack: { upsert: upsertTechs, remove: splitList(removedTechs) },
    };

    setSaving(true);
    try {
      if (await onSubmit(dto)) {
        formDraft.clear();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  }

  const error = localError ?? submitError;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) formDraft.requestClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl adr-dialog">
        {formDraft.protection}
        <DialogHeader>
          <DialogTitle>{initial ? `提交 ${initial.id} 的修订` : "发起新 ADR"}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto py-2">
          <div className="space-y-1.5">
            <Label htmlFor="adr-title">
              标题 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="adr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：网关不得引入 LLM 依赖"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adr-context">
              背景（为什么需要这次决策） <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="adr-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adr-decision">
              决策（定了什么） <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="adr-decision"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adr-consequences">后果（可选）</Label>
              <Textarea
                id="adr-consequences"
                value={consequences}
                onChange={(e) => setConsequences(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adr-alternatives">被否的替代方案（可选）</Label>
              <Textarea
                id="adr-alternatives"
                value={alternatives}
                onChange={(e) => setAlternatives(e.target.value)}
                rows={2}
              />
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
              <option value="human_asserted">human_asserted —— 人直接主张</option>
              <option value="agent_inferred">agent_inferred —— Agent 推断</option>
              <option value="imported">imported —— 外部导入</option>
            </select>
          </div>

          <p className="text-sm text-muted-foreground">
            提交后进入待评审；采纳时记录决定理由。修订会保留原文与已有意见。
          </p>
          {/* 架构原则行编辑器 */}
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>架构原则（可选）</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPrinciples((p) => [...p, { ...EMPTY_PRINCIPLE }])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> 加一条
              </Button>
            </div>
            {principles.length === 0 && (
              <p className="text-xs text-muted-foreground">
                不改变架构约束的决策（如"评估后决定不做"）可以不带原则——只填 title/context/decision
                即可。
              </p>
            )}
            {principles.map((row, i) => (
              <div key={i} className="space-y-1.5 rounded border bg-muted/20 p-2">
                <div className="flex gap-2">
                  <Input
                    className="font-mono"
                    placeholder="原则 id（slug，如 deep-tree-fetch）"
                    value={row.id}
                    onChange={(e) =>
                      setPrinciples((p) =>
                        p.map((r, j) => (j === i ? { ...r, id: e.target.value } : r)),
                      )
                    }
                  />
                  <select
                    value={row.strength}
                    onChange={(e) =>
                      setPrinciples((p) =>
                        p.map((r, j) =>
                          j === i ? { ...r, strength: e.target.value as PrincipleStrength } : r,
                        ),
                      )
                    }
                    className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  >
                    <option value="MUST">MUST</option>
                    <option value="SHOULD">SHOULD</option>
                    <option value="MAY">MAY</option>
                    <option value="MUST_NOT">MUST_NOT</option>
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPrinciples((p) => p.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea
                  placeholder="EARS 句式：当 <触发/条件>，<主体> 应当 <行为>"
                  rows={2}
                  value={row.statement}
                  onChange={(e) =>
                    setPrinciples((p) =>
                      p.map((r, j) => (j === i ? { ...r, statement: e.target.value } : r)),
                    )
                  }
                />
                <Textarea
                  placeholder="原则依据（可选）"
                  value={row.rationale}
                  onChange={(e) =>
                    setPrinciples((p) =>
                      p.map((r, j) => (j === i ? { ...r, rationale: e.target.value } : r)),
                    )
                  }
                />
                <ModulePicker
                  productId={productId}
                  value={splitList(row.module_ids)}
                  onChange={(ids) =>
                    setPrinciples((p) =>
                      p.map((r, j) => (j === i ? { ...r, module_ids: ids.join(", ") } : r)),
                    )
                  }
                />
              </div>
            ))}
          </div>

          {/* 技术栈行编辑器 */}
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>技术栈（可选）</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTechs((t) => [...t, { ...EMPTY_TECH }])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> 加一条
              </Button>
            </div>
            {techs.map((row, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded border p-2">
                <Input
                  className="font-mono"
                  placeholder="id"
                  value={row.id}
                  onChange={(e) =>
                    setTechs((t) => t.map((r, j) => (j === i ? { ...r, id: e.target.value } : r)))
                  }
                />
                <Input
                  aria-label="技术分层"
                  placeholder="技术分层"
                  value={row.layer}
                  onChange={(e) =>
                    setTechs((t) =>
                      t.map((r, j) => (j === i ? { ...r, layer: e.target.value } : r)),
                    )
                  }
                />
                <Input
                  aria-label="技术选择"
                  placeholder="技术选择"
                  value={row.choice}
                  onChange={(e) =>
                    setTechs((t) =>
                      t.map((r, j) => (j === i ? { ...r, choice: e.target.value } : r)),
                    )
                  }
                />
                <Input
                  aria-label="技术版本"
                  placeholder="版本（可选）"
                  value={row.version}
                  onChange={(e) =>
                    setTechs((t) =>
                      t.map((r, j) => (j === i ? { ...r, version: e.target.value } : r)),
                    )
                  }
                />
                <Input
                  placeholder="技术选择依据"
                  value={row.rationale}
                  onChange={(e) =>
                    setTechs((t) =>
                      t.map((r, j) => (j === i ? { ...r, rationale: e.target.value } : r)),
                    )
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTechs((t) => t.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adr-remove-principles">移除原则 ID（逗号分隔）</Label>
            <Input
              id="adr-remove-principles"
              value={removedPrinciples}
              onChange={(e) => setRemovedPrinciples(e.target.value)}
            />
            <Label htmlFor="adr-remove-techs">移除技术栈 ID（逗号分隔）</Label>
            <Input
              id="adr-remove-techs"
              value={removedTechs}
              onChange={(e) => setRemovedTechs(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <ModulePicker productId={productId} value={moduleIds} onChange={setModuleIds} />
        <fieldset className="space-y-2 rounded border p-3">
          <legend>从当前规则选择移除项</legend>
          <Input
            aria-label="搜索当前规则"
            placeholder="搜索规则 ID 或内容"
            value={ruleQuery}
            onChange={(e) => setRuleQuery(e.target.value)}
          />
          {(["architecture_principles", "tech_stack"] as const).map((category) =>
            (currentRules?.[category] ?? [])
              .filter((rule) =>
                JSON.stringify(rule).toLowerCase().includes(ruleQuery.toLowerCase()),
              )
              .map((rule) => {
                const selected = (category === "tech_stack" ? removedTechs : removedPrinciples)
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean);
                return (
                  <label key={`${category}:${rule.id}`} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(rule.id)}
                      onChange={(e) => {
                        const ids = e.target.checked
                          ? [...selected, rule.id]
                          : selected.filter((id) => id !== rule.id);
                        if (category === "tech_stack") setRemovedTechs(ids.join(", "));
                        else setRemovedPrinciples(ids.join(", "));
                      }}
                    />
                    {rule.id} · {"statement" in rule ? rule.statement : rule.choice}
                  </label>
                );
              }),
          )}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={formDraft.requestClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            提交评审
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
