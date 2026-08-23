'use client';

/**
 * 用户故事创建对话框
 *
 * 支持在故事地图中为指定旅程创建新的用户故事。
 * 表单字段与 StoryEditDialog 一致。
 */

import { useState, useEffect } from 'react';
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
import { Textarea } from '@x-cartographer/ui';
import { MarkdownField } from './markdown-field';
import { Priority } from '@/types';

interface StoryCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 目标旅程 ID */
  journeyId: string;
  /** 目标旅程名称（显示用） */
  journeyName: string;
  /** 回调：返回新建故事所需的字段（不含 id/order 等，由调用方生成） */
  onSave: (data: {
    journeyId: string;
    title: string;
    description: string;
    priority: Priority;
    estimation: number;
    acceptance_criteria: string[];
    tags: string[];
  }) => Promise<void>;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: Priority.HIGH, label: '高优先级' },
  { value: Priority.MEDIUM, label: '中优先级' },
  { value: Priority.LOW, label: '低优先级' },
];

export function StoryCreateDialog({
  open,
  onOpenChange,
  journeyId,
  journeyName,
  onSave,
}: StoryCreateDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [estimation, setEstimation] = useState(0);
  const [criteriaText, setCriteriaText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [saving, setSaving] = useState(false);

  // 打开时重置表单
  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setPriority(Priority.MEDIUM);
      setEstimation(0);
      setCriteriaText('');
      setTagsText('');
    }
  }, [open]);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSave() {
    if (!title.trim()) return;

    const criteria = criteriaText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const tags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      await onSave({
        journeyId,
        title: title.trim(),
        description: description.trim(),
        priority,
        estimation,
        acceptance_criteria: criteria,
        tags,
      });
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            新建用户故事
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              → {journeyName}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 标题 */}
          <div className="space-y-1.5">
            <Label htmlFor="new-story-title">
              标题 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-story-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="作为[角色]，我想要[功能]，以便[价值]"
            />
          </div>

          {/* 描述（Markdown 实时预览 + 草稿自动保存） */}
          <MarkdownField
            id="new-story-description"
            label="详细描述"
            value={description}
            onChange={setDescription}
            placeholder="补充背景信息、业务逻辑说明等...（支持 Markdown 语法）"
            draftKey={`story-create:${journeyId}`}
          />

          {/* 优先级 + 工时 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>优先级</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-story-estimation">估算工时 (h)</Label>
              <Input
                id="new-story-estimation"
                type="number"
                min={0}
                step={0.5}
                value={estimation}
                onChange={(e) => setEstimation(parseFloat(e.target.value) || 0)}
                className="h-9"
              />
            </div>
          </div>

          {/* 验收标准 */}
          <div className="space-y-1.5">
            <Label htmlFor="new-story-criteria">
              验收标准
              <span className="ml-1 text-xs text-muted-foreground">
                （每行一条）
              </span>
            </Label>
            <Textarea
              id="new-story-criteria"
              value={criteriaText}
              onChange={(e) => setCriteriaText(e.target.value)}
              placeholder={'用户可以成功完成注册\n用户收到确认邮件\n...'}
              className="min-h-[100px] resize-none font-mono text-sm"
            />
          </div>

          {/* 标签 */}
          <div className="space-y-1.5">
            <Label htmlFor="new-story-tags">
              标签
              <span className="ml-1 text-xs text-muted-foreground">
                （逗号分隔）
              </span>
            </Label>
            <Input
              id="new-story-tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="frontend, auth, MVP"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
