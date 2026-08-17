'use client';

/**
 * 版本（里程碑）创建/编辑对话框
 * 排期模型：版本有名称、目标、可选目标日期、状态
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@xpm/ui';
import { Button, Input, Label, Textarea } from '@xpm/ui';

export type MilestoneStatus = 'planned' | 'active' | 'completed';

interface MilestoneFormData {
  name: string;
  goal: string;
  target_date?: string;
  status?: MilestoneStatus;
}

interface MilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 编辑模式传入现有版本，创建模式为 null */
  initial?: {
    name: string;
    goal: string;
    target_date?: string;
    status?: string;
  } | null;
  onSave: (data: MilestoneFormData) => Promise<void>;
}

export function MilestoneDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: MilestoneDialogProps) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('planned');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setGoal(initial?.goal ?? '');
      setTargetDate(initial?.target_date?.slice(0, 10) ?? '');
      setStatus((initial?.status ?? 'planned') as MilestoneStatus);
    }
  }, [open, initial]);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        goal: goal.trim(),
        target_date: targetDate || undefined,
        status,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? '编辑版本' : '新建版本'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="milestone-name">版本名称</Label>
            <Input
              id="milestone-name"
              placeholder="如 v1.0"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="milestone-goal">版本目标</Label>
            <Textarea
              id="milestone-goal"
              placeholder="本版本要交付什么"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="milestone-date">目标日期（可选）</Label>
            <Input
              id="milestone-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>版本状态</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
            >
              <option value="planned">规划中</option>
              <option value="active">进行中</option>
              <option value="completed">已完成</option>
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
