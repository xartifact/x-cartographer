'use client';

/**
 * 新建任务对话框
 *
 * 创建任务时明确绑定所属旅程和故事，体现「任务 → 故事 → 旅程」的层级关系。
 */

import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@x-cartographer/ui';
import { Button } from '@x-cartographer/ui';
import { Input } from '@x-cartographer/ui';
import { Label } from '@x-cartographer/ui';
import type { TaskPriority, Product } from '@/types';
import { TaskPriority as TaskPriorityEnum, TaskStatus } from '@/types';

/** 新建任务草稿：ID 由服务端序列分配（禁止前端伪造主键） */
export interface NewDevTaskDraft {
  storyId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  estimation: number;
  dependencies: string[];
  tags: string[];
}

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Product;
  onSave: (draft: NewDevTaskDraft) => Promise<void>;
}

const TASK_PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: TaskPriorityEnum.P0, label: 'P0 - 紧急' },
  { value: TaskPriorityEnum.P1, label: 'P1 - 高' },
  { value: TaskPriorityEnum.P2, label: 'P2 - 中' },
  { value: TaskPriorityEnum.P3, label: 'P3 - 低' },
];

export function TaskCreateDialog({ open, onOpenChange, project, onSave }: TaskCreateDialogProps) {
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriorityEnum.P1);
  const [estimation, setEstimation] = useState(2);
  const [saving, setSaving] = useState(false);

  const activities = useMemo(() => project.user_activities ?? [], [project.user_activities]);

  const storiesInActivity = useMemo(() => {
    if (!selectedActivityId) return [];
    return activities.find((j) => j.id === selectedActivityId)?.stories ?? [];
  }, [activities, selectedActivityId]);

  function handleActivityChange(activityId: string) {
    setSelectedActivityId(activityId);
    setSelectedStoryId('');
  }

  function handleClose() {
    setSelectedActivityId('');
    setSelectedStoryId('');
    setTitle('');
    setPriority(TaskPriorityEnum.P1);
    setEstimation(2);
    onOpenChange(false);
  }

  async function handleSave() {
    if (!title.trim() || !selectedStoryId) return;

    // 主键由服务端分配（TASK-xxx 序列），前端只提交内容字段
    const draft: NewDevTaskDraft = {
      storyId: selectedStoryId,
      title: title.trim(),
      description: '',
      priority,
      estimation,
      dependencies: [],
      tags: [],
    };

    setSaving(true);
    try {
      await onSave(draft);
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  const canSave = title.trim().length > 0 && selectedStoryId !== '';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 步骤 1：选择活动 */}
          <div className="space-y-1.5">
            <Label htmlFor="activity-select">
              所属活动 <span className="text-muted-foreground text-xs">（用于筛选故事）</span>
            </Label>
            <select
              id="activity-select"
              value={selectedActivityId}
              onChange={(e) => handleActivityChange(e.target.value)}
              className="w-full text-sm h-9 rounded-md border bg-background px-3"
            >
              <option value="">— 选择活动 —</option>
              {activities.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          </div>

          {/* 步骤 2：选择故事（绑定关系） */}
          <div className="space-y-1.5">
            <Label htmlFor="story-select">
              所属故事 <span className="text-destructive">*</span>
            </Label>
            <select
              id="story-select"
              value={selectedStoryId}
              onChange={(e) => setSelectedStoryId(e.target.value)}
              disabled={!selectedActivityId}
              className="w-full text-sm h-9 rounded-md border bg-background px-3 disabled:opacity-50"
            >
              <option value="">— 选择故事 —</option>
              {storiesInActivity.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.id}] {s.title}
                </option>
              ))}
            </select>
            {!selectedActivityId && (
              <p className="text-xs text-muted-foreground">请先选择活动</p>
            )}
          </div>

          {/* 步骤 3：任务标题 */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">
              任务标题 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              placeholder="输入任务标题..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave(); }}
            />
          </div>

          {/* 步骤 4-5：优先级 / 工时 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>优先级</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-sm h-9 rounded-md border bg-background px-2"
              >
                {TASK_PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>估算工时 (h)</Label>
              <Input
                type="number"
                min={0.5}
                max={40}
                step={0.5}
                value={estimation}
                onChange={(e) => setEstimation(parseFloat(e.target.value) || 1)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>取消</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            创建任务
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
