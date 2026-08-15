'use client';

/**
 * 故事编辑对话框
 *
 * 支持编辑用户故事的标题、描述、优先级、估算工时、验收标准和标签。
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
import { Button } from '@xpm/ui';
import { Input } from '@xpm/ui';
import { Label } from '@xpm/ui';
import { Textarea } from '@xpm/ui';
import { UserStory } from '@/types/user-story';
import { Priority } from '@/types';

interface StoryEditDialogProps {
  open: boolean;
  story: UserStory | null;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: UserStory) => Promise<void>;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: Priority.HIGH, label: '高优先级' },
  { value: Priority.MEDIUM, label: '中优先级' },
  { value: Priority.LOW, label: '低优先级' },
];

export function StoryEditDialog({ open, story, onOpenChange, onSave }: StoryEditDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [estimation, setEstimation] = useState(0);
  const [criteriaText, setCriteriaText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [saving, setSaving] = useState(false);

  // 当 story 变化时重置表单
  useEffect(() => {
    if (story) {
      setTitle(story.title);
      setDescription(story.description ?? '');
      setPriority(story.priority);
      setEstimation(story.estimation ?? 0);
      setCriteriaText((story.acceptance_criteria ?? []).join('\n'));
      setTagsText((story.tags ?? []).join(', '));
    }
  }, [story]);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSave() {
    if (!story || !title.trim()) return;

    const criteria = criteriaText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const tags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: UserStory = {
      ...story,
      title: title.trim(),
      description: description.trim(),
      priority,
      estimation,
      acceptance_criteria: criteria,
      tags,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await onSave(updated);
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
            编辑故事
            {story && (
              <span className="ml-2 text-sm font-mono text-muted-foreground">{story.id}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 标题 */}
          <div className="space-y-1.5">
            <Label htmlFor="story-title">
              标题 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="story-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="作为[角色]，我想要[功能]，以便[价值]"
            />
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <Label htmlFor="story-description">详细描述</Label>
            <Textarea
              id="story-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充背景信息、业务逻辑说明等..."
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* 优先级 + 工时 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>优先级</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full text-sm h-9 rounded-md border bg-background px-3"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="story-estimation">估算工时 (h)</Label>
              <Input
                id="story-estimation"
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
            <Label htmlFor="story-criteria">
              验收标准
              <span className="ml-1 text-xs text-muted-foreground">（每行一条）</span>
            </Label>
            <Textarea
              id="story-criteria"
              value={criteriaText}
              onChange={(e) => setCriteriaText(e.target.value)}
              placeholder={"用户可以成功完成注册\n用户收到确认邮件\n..."}
              className="min-h-[100px] resize-none font-mono text-sm"
            />
          </div>

          {/* 标签 */}
          <div className="space-y-1.5">
            <Label htmlFor="story-tags">
              标签
              <span className="ml-1 text-xs text-muted-foreground">（逗号分隔）</span>
            </Label>
            <Input
              id="story-tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="frontend, auth, MVP"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>取消</Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
