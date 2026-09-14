'use client';

/**
 * 用户故事创建对话框
 *
 * 支持在故事地图中创建新的用户故事；提供 activities 时可在表单内切换目标活动（TASK-035）。
 * 表单字段与 StoryEditDialog 一致。
 */

import { useState, useEffect, useMemo } from 'react';
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
  /** 目标活动 ID（默认选中） */
  activityId: string;
  /** 目标活动名称（显示用；未提供 activities 时静态展示） */
  activityName: string;
  /** 可选活动列表（TASK-035）：提供时展示下拉选择，可切换目标活动；缺省回退 activityId */
  activities?: { id: string; name: string }[];
  /** 回调：返回新建故事所需的字段（不含 id/order 等，由调用方生成） */
  onSave: (data: {
    activityId: string;
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
  activityId,
  activityName,
  activities,
  onSave,
}: StoryCreateDialogProps) {
  const [selectedActivityId, setSelectedActivityId] = useState(activityId);
  const [title, setTitle] = useState('');
  // 标准格式组合模式（TASK-031）：角色/功能/价值三字段自动生成标题
  const [composeMode, setComposeMode] = useState(true);
  const [role, setRole] = useState('');
  const [feature, setFeature] = useState('');
  const [value, setValue] = useState('');
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
      setComposeMode(true);
      setRole('');
      setFeature('');
      setValue('');
      setDescription('');
      setPriority(Priority.MEDIUM);
      setEstimation(0);
      setCriteriaText('');
      setTagsText('');
      setSelectedActivityId(activityId);
    }
  }, [open, activityId]);

  // 标准格式自动生成：「作为[角色]，我想要[功能]，以便[价值]」
  const composedTitle = useMemo(() => {
    if (!role.trim() && !feature.trim() && !value.trim()) return '';
    return `作为${role.trim() || '…'}，我想要${feature.trim() || '…'}，以便${value.trim() || '…'}`;
  }, [role, feature, value]);
  const effectiveTitle = composeMode ? composedTitle : title;

  // TASK-035：活动下拉选项；未提供 activities 时回退为仅当前活动（保持旧的静态展示行为）
  const activityOptions = useMemo(() => {
    if (!activities || activities.length === 0) {
      return [{ id: activityId, name: activityName }];
    }
    return activities.some((a) => a.id === activityId)
      ? activities
      : [{ id: activityId, name: activityName }, ...activities];
  }, [activities, activityId, activityName]);
  const selectedActivityName =
    activityOptions.find((a) => a.id === selectedActivityId)?.name ?? activityName;
  const canSave = composeMode
    ? Boolean(role.trim() && feature.trim() && value.trim())
    : Boolean(title.trim());

  function toggleComposeMode() {
    if (composeMode && !title.trim()) {
      // 切到手动输入时保留已生成的内容
      setTitle(composedTitle);
    }
    setComposeMode((m) => !m);
  }

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSave() {
    if (!effectiveTitle.trim()) return;

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
        activityId: selectedActivityId,
        title: effectiveTitle.trim(),
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
              → {selectedActivityName}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 所属活动（TASK-035）：提供 activities 时可切换目标活动 */}
          {activities?.length ? (
            <div className="space-y-1.5">
              <Label htmlFor="new-story-activity">所属活动</Label>
              <select
                id="new-story-activity"
                value={selectedActivityId}
                onChange={(e) => setSelectedActivityId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {activityOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {/* 标题：标准格式三字段组合 / 手动输入 双模式 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                标题 <span className="text-destructive">*</span>
              </Label>
              <button
                type="button"
                onClick={toggleComposeMode}
                className="cursor-pointer border-0 bg-transparent p-0 text-xs text-muted-foreground hover:text-foreground"
              >
                {composeMode ? '手动输入标题' : '使用标准格式'}
              </button>
            </div>
            {composeMode ? (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-sm">作为</span>
                  <Input
                    id="new-story-role"
                    aria-label="角色"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="产品经理"
                    className="h-8 flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-sm">我想要</span>
                  <Input
                    id="new-story-feature"
                    aria-label="功能"
                    value={feature}
                    onChange={(e) => setFeature(e.target.value)}
                    placeholder="为活动步骤创建用户故事"
                    className="h-8 flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-sm">以便</span>
                  <Input
                    id="new-story-value"
                    aria-label="价值"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="详细描述功能需求"
                    className="h-8 flex-1"
                  />
                </div>
                {(role || feature || value) && (
                  <p className="border-t pt-2 text-sm text-muted-foreground">
                    {composedTitle}
                  </p>
                )}
              </div>
            ) : (
              <Input
                id="new-story-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="作为[角色]，我想要[功能]，以便[价值]"
              />
            )}
          </div>

          {/* 描述（Markdown 实时预览 + 草稿自动保存） */}
          <MarkdownField
            id="new-story-description"
            label="详细描述"
            value={description}
            onChange={setDescription}
            placeholder="补充背景信息、业务逻辑说明等...（支持 Markdown 语法）"
            draftKey={`story-create:${selectedActivityId}`}
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
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
