import { useFormDraft } from "@/lib/hooks/use-form-draft";
import { useState } from "react";
import { Button, Input, Label, Textarea } from "@x-cartographer/ui";
import { useUpdateDevTask } from "@/lib/api/hooks";
import { ModulePicker } from "@/components/common/module-picker";
import type { DevTask, TaskPriority } from "@/types";
import { toast } from "sonner";
export function TaskEditForm({
  task,
  productId,
  onDone,
  onRegisterClose,
}: {
  task: DevTask;
  productId: string;
  onDone: () => void;
  onRegisterClose?: (fn: () => void) => void;
}) {
  const [draft, setDraft] = useState({
    title: task.title,
    description: task.description,
    priority: task.priority,
    estimation: task.estimation,
    assignee: task.assignee ?? "",
    tags: task.tags.join(", "),
    affectedModules: task.affected_modules ?? [],
  });
  const update = useUpdateDevTask();
  const [error, setError] = useState("");
  const formDraft = useFormDraft({
    open: true,
    scope: `task-edit:${productId}:${task.id}`,
    values: { draft },
    restore: (v) => setDraft(v.draft),
    close: onDone,
    saving: update.isPending,
    version: task.updated_at,
  });
  onRegisterClose?.(formDraft.requestClose);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await update.mutateAsync({
            id: task.id,
            ...draft,
            tags: draft.tags
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          });
          toast.success("任务已更新");
          formDraft.clear();
          onDone();
        } catch (e) {
          setError(e instanceof Error ? e.message : "保存失败");
        }
      }}
    >
      {formDraft.protection}
      <Label htmlFor="edit-task-title">标题</Label>
      <Input
        id="edit-task-title"
        required
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
      />
      <Label htmlFor="edit-task-desc">描述</Label>
      <Textarea
        id="edit-task-desc"
        rows={6}
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
      />
      <Label htmlFor="edit-task-priority">优先级</Label>
      <select
        id="edit-task-priority"
        className="h-9 border rounded bg-background"
        value={draft.priority}
        onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })}
      >
        {["P0", "P1", "P2", "P3"].map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <Label htmlFor="edit-task-estimation">估算工时</Label>
      <Input
        id="edit-task-estimation"
        type="number"
        min={0}
        step={0.5}
        value={draft.estimation}
        onChange={(e) => setDraft({ ...draft, estimation: Number(e.target.value) })}
      />
      <Label htmlFor="edit-task-assignee">负责人</Label>
      <Input
        id="edit-task-assignee"
        value={draft.assignee}
        onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}
      />
      <Label htmlFor="edit-task-tags">标签（逗号分隔）</Label>
      <Input
        id="edit-task-tags"
        value={draft.tags}
        onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
      />
      <ModulePicker
        productId={productId}
        value={draft.affectedModules}
        onChange={(affectedModules) => setDraft({ ...draft, affectedModules })}
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="sticky bottom-0 flex gap-2 bg-background py-3">
        <Button disabled={update.isPending || !draft.title.trim()} type="submit">
          {update.isPending ? "保存中…" : "保存修改"}
        </Button>
        <Button type="button" variant="outline" onClick={formDraft.requestClose}>
          取消
        </Button>
      </div>
    </form>
  );
}
