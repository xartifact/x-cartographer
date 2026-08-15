'use client';

/**
 * 新建任务对话框
 *
 * 创建任务时明确绑定所属旅程和故事，体现「任务 → 故事 → 旅程」的层级关系。
 */

import { useState, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@xpm/ui';
import { Button } from '@xpm/ui';
import { Input } from '@xpm/ui';
import { Label } from '@xpm/ui';
import type { Task, TaskType, TaskPriority, Project } from '@/types';
import { TaskType as TaskTypeEnum, TaskPriority as TaskPriorityEnum, TaskStatus } from '@/types';

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onSave: (storyId: string, task: Task) => Promise<void>;
}

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: TaskTypeEnum.TECHNICAL_TASK, label: '技术任务' },
  { value: TaskTypeEnum.USER_STORY, label: '功能实现' },
  { value: TaskTypeEnum.BUG_FIX, label: 'Bug 修复' },
  { value: TaskTypeEnum.SPIKE, label: '技术探索' },
];

const TASK_PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: TaskPriorityEnum.P0, label: 'P0 - 紧急' },
  { value: TaskPriorityEnum.P1, label: 'P1 - 高' },
  { value: TaskPriorityEnum.P2, label: 'P2 - 中' },
  { value: TaskPriorityEnum.P3, label: 'P3 - 低' },
];

export function TaskCreateDialog({ open, onOpenChange, project, onSave }: TaskCreateDialogProps) {
  const [selectedJourneyId, setSelectedJourneyId] = useState('');
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>(TaskTypeEnum.TECHNICAL_TASK);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriorityEnum.P1);
  const [estimation, setEstimation] = useState(2);
  const [saving, setSaving] = useState(false);

  const journeys = useMemo(() => project.user_journeys ?? [], [project.user_journeys]);

  const storiesInJourney = useMemo(() => {
    if (!selectedJourneyId) return [];
    return journeys.find((j) => j.id === selectedJourneyId)?.stories ?? [];
  }, [journeys, selectedJourneyId]);

  function handleJourneyChange(journeyId: string) {
    setSelectedJourneyId(journeyId);
    setSelectedStoryId('');
  }

  function handleClose() {
    setSelectedJourneyId('');
    setSelectedStoryId('');
    setTitle('');
    setType(TaskTypeEnum.TECHNICAL_TASK);
    setPriority(TaskPriorityEnum.P1);
    setEstimation(2);
    onOpenChange(false);
  }

  async function handleSave() {
    if (!title.trim() || !selectedStoryId) return;

    const now = new Date().toISOString();
    const task: Task = {
      id: `TASK-${nanoid(8)}`,
      story_id: selectedStoryId,
      title: title.trim(),
      description: '',
      type,
      priority,
      estimation,
      status: TaskStatus.BACKLOG,
      dependencies: [],
      tags: [],
      created_at: now,
      updated_at: now,
    };

    setSaving(true);
    try {
      await onSave(selectedStoryId, task);
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
          {/* 步骤 1：选择旅程 */}
          <div className="space-y-1.5">
            <Label htmlFor="journey-select">
              所属旅程 <span className="text-muted-foreground text-xs">（用于筛选故事）</span>
            </Label>
            <select
              id="journey-select"
              value={selectedJourneyId}
              onChange={(e) => handleJourneyChange(e.target.value)}
              className="w-full text-sm h-9 rounded-md border bg-background px-3"
            >
              <option value="">— 选择旅程 —</option>
              {journeys.map((j) => (
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
              disabled={!selectedJourneyId}
              className="w-full text-sm h-9 rounded-md border bg-background px-3 disabled:opacity-50"
            >
              <option value="">— 选择故事 —</option>
              {storiesInJourney.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.id}] {s.title}
                </option>
              ))}
            </select>
            {!selectedJourneyId && (
              <p className="text-xs text-muted-foreground">请先选择旅程</p>
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

          {/* 步骤 4-6：类型 / 优先级 / 工时 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>任务类型</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TaskType)}
                className="w-full text-sm h-9 rounded-md border bg-background px-2"
              >
                {TASK_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
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
