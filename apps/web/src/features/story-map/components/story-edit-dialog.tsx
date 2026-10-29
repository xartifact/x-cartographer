"use client";
import { useProduct } from "@/lib/api/hooks";

import { ModulePicker } from "@/components/common/module-picker";

import { useFormDraft } from "@/lib/hooks/use-form-draft";

/**
 * 故事编辑对话框
 *
 * 支持编辑用户故事的标题、描述、优先级、估算工时、验收标准和标签。
 */

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@x-cartographer/ui";
import { Button } from "@x-cartographer/ui";
import { Input } from "@x-cartographer/ui";
import { Label } from "@x-cartographer/ui";
import { Textarea } from "@x-cartographer/ui";
import { MarkdownField } from "./markdown-field";
import { UserStory } from "@/types/user-story";
import { Priority } from "@/types";

interface StoryEditDialogProps {
  open: boolean;
  story: UserStory | null;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: UserStory) => Promise<void>;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: Priority.HIGH, label: "高优先级" },
  { value: Priority.MEDIUM, label: "中优先级" },
  { value: Priority.LOW, label: "低优先级" },
];

export function StoryEditDialog({ open, story, onOpenChange, onSave }: StoryEditDialogProps) {
  const { data: product } = useProduct(location.pathname.split("/")[2]);
  const [activityId, setActivityId] = useState("");
  const [stepId, setStepId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [estimation, setEstimation] = useState(0);
  const [criteriaText, setCriteriaText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [affectedModules, setAffectedModules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const formDraft = useFormDraft({
    open,
    scope: `story:${story?.id}`,
    values: {
      activityId,
      stepId,
      affectedModules,
      title,
      description,
      priority,
      estimation,
      criteriaText,
      tagsText,
    },
    restore: (v) => {
      setActivityId(v.activityId);
      setStepId(v.stepId);
      setAffectedModules(v.affectedModules);
      setTitle(v.title);
      setDescription(v.description);
      setPriority(v.priority);
      setEstimation(v.estimation);
      setCriteriaText(v.criteriaText);
      setTagsText(v.tagsText);
    },
    close: () => onOpenChange(false),
    saving,
    version: story?.updated_at,
  });

  // 当 story 变化时重置表单
  useEffect(() => {
    if (open && story) {
      setActivityId(story.activity_id);
      setStepId(story.user_task_id ?? "");
      setAffectedModules(story.affected_modules ?? []);
      setTitle(story.title);
      setDescription(story.description ?? "");
      setPriority(story.priority);
      setEstimation(story.estimation ?? 0);
      setCriteriaText((story.acceptance_criteria ?? []).join("\n"));
      setTagsText((story.tags ?? []).join(", "));
    }
    // Keep edits when background refetch changes the same entity object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, story?.id]);

  function handleClose() {
    formDraft.requestClose();
  }

  async function handleSave() {
    if (!story || !title.trim()) return;

    const criteria = criteriaText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const tags = tagsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: UserStory = {
      ...story,
      activity_id: activityId,
      user_task_id: stepId || undefined,
      affected_modules: affectedModules,
      title: title.trim(),
      description: description.trim(),
      priority,
      estimation,
      acceptance_criteria: criteria,
      tags,
      updated_at: new Date().toISOString(),
    };

    if (saving) return;
    setSubmitError("");
    setSaving(true);
    try {
      await onSave(updated);
      formDraft.clear();
      onOpenChange(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {formDraft.protection}
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

          {/* 描述（Markdown 实时预览 + 草稿自动保存） */}
          <MarkdownField
            id="story-description"
            label="详细描述"
            value={description}
            onChange={setDescription}
            placeholder="补充背景信息、业务逻辑说明等...（支持 Markdown 语法）"
            draftKey={story ? `story-edit:${story.id}` : undefined}
          />

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
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
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

        <Label htmlFor="edit-story-activity">所属活动</Label>
        <select
          id="edit-story-activity"
          className="h-9 rounded border bg-background"
          value={activityId}
          onChange={(e) => {
            setActivityId(e.target.value);
            setStepId("");
          }}
        >
          {product?.user_activities?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <Label htmlFor="edit-story-step">所属用户步骤</Label>
        <select
          id="edit-story-step"
          className="h-9 rounded border bg-background"
          value={stepId}
          onChange={(e) => setStepId(e.target.value)}
        >
          <option value="">未分配</option>
          {product?.user_activities
            ?.find((a) => a.id === activityId)
            ?.user_tasks?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
        <ModulePicker
          productId={location.pathname.split("/")[2] ?? ""}
          value={affectedModules}
          onChange={setAffectedModules}
        />
        {submitError && (
          <p role="alert" className="text-destructive text-sm">
            {submitError}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
