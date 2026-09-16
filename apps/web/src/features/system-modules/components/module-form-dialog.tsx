'use client';

/**
 * 模块新建/编辑对话框
 *
 * 新建与编辑复用同一表单：`PUT /api/system-modules/:id` 是幂等 upsert，
 * 两者差别仅在于「id 可否修改」与「重名是否报错」（见 lib/module-form.ts）。
 * 编辑态锁定 id：模块被人按 slug 引用（principles.module_ids / affected_modules），
 * 改 id 等于换实体，不是改名——要换 slug 就删了重建。
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@x-cartographer/ui';
import type { SystemModule } from '@x-cartographer/shared';
import {
  MODULE_ID_PATTERN,
  hasErrors,
  mergeDependencies,
  validateModuleForm,
  type ModuleFormDraft,
  type ModuleFormErrors,
} from '../lib/module-form';

interface ModuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 已有模块目录（依赖多选 + 重名校验的数据源） */
  modules: readonly SystemModule[];
  /** 编辑目标；null = 新建 */
  editing: SystemModule | null;
  /** 服务端/网络失败原因（slug 非法、重名、请求失败），由页面回填 */
  submitError: string | null;
  /** 提交草稿；返回 false 表示失败（对话框保持打开并显示 submitError） */
  onSubmit: (draft: ModuleFormDraft) => Promise<boolean>;
}

const EMPTY_DRAFT: ModuleFormDraft = {
  id: '',
  name: '',
  path: '',
  responsibility: '',
  selectedDeps: [],
  extraDeps: '',
};

export function ModuleFormDialog({
  open,
  onOpenChange,
  modules,
  editing,
  submitError,
  onSubmit,
}: ModuleFormDialogProps) {
  const [draft, setDraft] = useState<ModuleFormDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<ModuleFormErrors>({});
  const [saving, setSaving] = useState(false);

  // 打开时用编辑目标（或空草稿）重置表单，避免上一次输入残留
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setDraft(
      editing
        ? {
            id: editing.id,
            name: editing.name,
            path: editing.path,
            responsibility: editing.responsibility,
            selectedDeps: [],
            // 已登记的依赖回填为逗号分隔文本：它们可能指向已删除模块，
            // 不在多选列表里，放进自由输入才不会静默丢失
            extraDeps: (editing.depends_on ?? []).join(', '),
          }
        : EMPTY_DRAFT
    );
  }, [open, editing]);

  const isCreate = !editing;
  const existingIds = modules.map((m) => m.id);
  /** 依赖候选：排除自身（模块不能依赖自己） */
  const depCandidates = modules.filter((m) => m.id !== draft.id);

  function patch(next: Partial<ModuleFormDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function toggleDep(id: string, checked: boolean) {
    patch({
      selectedDeps: checked
        ? [...draft.selectedDeps, id]
        : draft.selectedDeps.filter((dep) => dep !== id),
    });
  }

  async function handleSubmit() {
    const nextErrors = validateModuleForm(draft, { existingIds, isCreate });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSaving(true);
    try {
      // 仅成功时关闭：失败时保留用户输入，错误由页面经 submitError 传回
      if (await onSubmit(draft)) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? '新建模块' : `编辑模块 ${editing.id}`}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          <div className="space-y-1.5">
            <Label htmlFor="module-id">
              模块 id <span className="text-destructive">*</span>
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                小写 slug，如 web-spa
              </span>
            </Label>
            <Input
              id="module-id"
              placeholder="web-spa"
              value={draft.id}
              readOnly={!isCreate}
              onChange={(e) => patch({ id: e.target.value })}
              className={isCreate ? 'font-mono' : 'font-mono opacity-70'}
            />
            {isCreate ? (
              <p className="text-xs text-muted-foreground">
                规则：{MODULE_ID_PATTERN.source}；该 id 会被故事/任务的受影响模块按名引用，是稳定标识。
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                模块 id 不可修改——它已被引用，改名等于新建另一个模块。
              </p>
            )}
            {errors.id && <p className="text-xs text-destructive">{errors.id}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="module-name">
              模块名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="module-name"
              placeholder="Web 前端"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="module-path">代码库路径</Label>
            <Input
              id="module-path"
              placeholder="apps/web"
              value={draft.path}
              onChange={(e) => patch({ path: e.target.value })}
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="module-responsibility">职责</Label>
            <Textarea
              id="module-responsibility"
              placeholder="这个模块负责什么（排查影响面时的第一手依据）"
              value={draft.responsibility}
              onChange={(e) => patch({ responsibility: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>依赖的模块</Label>
            {depCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                目录里还没有其他模块可依赖（可在下方直接输入将来登记的 id）。
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {depCandidates.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent/40"
                  >
                    <Checkbox
                      checked={draft.selectedDeps.includes(m.id)}
                      onCheckedChange={(checked) => toggleDep(m.id, checked === true)}
                    />
                    <span className="font-mono text-xs text-muted-foreground">{m.id}</span>
                    <span className="truncate">{m.name}</span>
                  </label>
                ))}
              </div>
            )}
            <Input
              placeholder="或直接输入模块 id，逗号分隔（如 gateway, shared-types）"
              value={draft.extraDeps}
              onChange={(e) => patch({ extraDeps: e.target.value })}
            />
            {errors.depends_on && <p className="text-xs text-destructive">{errors.depends_on}</p>}
          </div>
          {submitError && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{submitError}</span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCreate ? '创建模块' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 由表单草稿构造写入 payload 的依赖列表（页面与对话框共享同一归一逻辑） */
export function resolveDraftDependencies(draft: ModuleFormDraft): string[] {
  return mergeDependencies(draft.selectedDeps, draft.extraDeps, draft.id.trim()).ids;
}
