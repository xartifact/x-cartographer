import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Textarea,
  Label,
} from "@x-cartographer/ui";
import { StatusSelect } from "@/features/tasks/components/status-select";
import { api } from "@/lib/api/client";
import { toApiError } from "@/lib/api/error";
import type { TaskStatus, StoryStatus } from "@/types";
export function EntityStatusControl({
  id,
  status,
  isTask = true,
  disabled = false,
}: {
  id: string;
  status: TaskStatus | StoryStatus;
  isTask?: boolean;
  disabled?: boolean;
}) {
  const [target, setTarget] = useState<TaskStatus | StoryStatus | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const client = useQueryClient();
  async function save() {
    if (!target || !reason.trim()) return;
    setPending(true);
    setError("");
    try {
      const res = isTask
        ? status === "todo" && target === "in_progress"
          ? await api.api["dev-tasks"][":id"].claim.$post({ param: { id }, json: { reason } })
          : await api.api["dev-tasks"][":id"].status.$post({
              param: { id },
              json: { status: target as TaskStatus, reason, expected_status: status as TaskStatus },
            })
        : await api.api.stories[":id"].status.$post({
            param: { id },
            json: { status: target as StoryStatus, reason },
          });
      if (!res.ok) throw await toApiError(res, "状态更新失败，请刷新后核对");
      await Promise.all(
        ["products", "dev-tasks", "stories", "status-changes"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
      setTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    } finally {
      setPending(false);
    }
  }
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <StatusSelect
        status={status}
        isTask={isTask}
        disabled={disabled || pending}
        onStatusChange={(next) => {
          if (next !== status) {
            setTarget(next);
            setReason("");
            setError("");
          }
        }}
      />
      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !pending) setTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认更改状态 · {id}</DialogTitle>
          </DialogHeader>
          <p>
            {status} → {target}
          </p>
          <Label htmlFor={`status-reason-${id}`}>变更原因</Label>
          <Textarea
            id={`status-reason-${id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setTarget(null)}>
              取消
            </Button>
            <Button disabled={pending || !reason.trim()} onClick={() => void save()}>
              {pending ? "保存中…" : "确认更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
