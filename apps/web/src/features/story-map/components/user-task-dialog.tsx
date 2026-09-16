'use client';

/**
 * 用户任务（地图任务列）创建/编辑对话框
 *
 * UserTask = 活动下的用户操作步骤（Patton 骨架第二层脊线），故事地图里 = 一个窄列。
 * 见 docs/design/domain-model.md §8 阶段 D（地图内创建入口）与 Q3 决策说明。
 * 字段 name/description/order，与 ActivityCreateDialog 同范式。
 *
 * 表单种子由调用方在**打开时定格**后传入（`seed`）：不要在渲染中现算对象字面量，
 * 否则父组件每次 re-render（如后台 refetch 让 activities 换身份）都会重跑下面的
 * 重置 effect，把用户正在输入的内容清掉。
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Textarea,
} from '@x-cartographer/ui';

/** 对话框回传的任务字段（不含 id/activity_id，由调用方补） */
export interface UserTaskFormData {
  name: string;
  description: string;
  order: number;
}

interface UserTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 打开时定格的表单种子（同一会话内引用稳定） */
  seed: UserTaskFormData;
  /** 编辑已有任务列 / 新建任务列 */
  mode: 'create' | 'edit';
  /** 创建模式的目标活动名（标题展示） */
  activityName?: string;
  onSave: (data: UserTaskFormData) => Promise<void>;
}

export function UserTaskDialog({
  open,
  onOpenChange,
  seed,
  mode,
  activityName,
  onSave,
}: UserTaskDialogProps) {
  const [name, setName] = useState(seed.name);
  const [description, setDescription] = useState(seed.description);
  const [orderText, setOrderText] = useState(String(seed.order));
  const [saving, setSaving] = useState(false);

  // 打开时按种子重置表单（seed 引用稳定 → 仅在开新会话时触发）
  useEffect(() => {
    if (open) {
      setName(seed.name);
      setDescription(seed.description);
      setOrderText(String(seed.order));
    }
  }, [open, seed]);

  const order = Number.parseInt(orderText, 10);
  const orderValid = Number.isInteger(order) && order >= 0;
  const canSave = Boolean(name.trim()) && orderValid && !saving;
  const isEdit = mode === 'edit';

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSave() {
    if (!name.trim() || !orderValid) return;

    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), order });
      handleClose();
    } catch {
      // 失败提示由调用方 toast 承担；此处保持对话框打开，便于修正后重试
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? '编辑任务列' : '新建任务列'}
            {!isEdit && activityName ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                → {activityName}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 任务名 */}
          <div className="space-y-1.5">
            <Label htmlFor="user-task-name">
              任务名 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="用户操作步骤，例如：拖拽调整故事位置"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) {
                  void handleSave();
                }
              }}
            />
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <Label htmlFor="user-task-description">描述</Label>
            <Textarea
              id="user-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="这一步用户具体在做什么..."
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* 活动内排序 */}
          <div className="space-y-1.5">
            <Label htmlFor="user-task-order">排序</Label>
            <Input
              id="user-task-order"
              type="number"
              min={0}
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              决定任务列在活动内的左右次序；默认追加到末尾。
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? '保存' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
