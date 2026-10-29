import type { DevTask } from "@/types";
export function taskMetrics(tasks: readonly Pick<DevTask, "status">[]) {
  const cancelled = tasks.filter((t) => t.status === "cancelled").length;
  const active = tasks.length - cancelled;
  const done = tasks.filter((t) => t.status === "done").length;
  return {
    total: tasks.length,
    active,
    cancelled,
    done,
    percent: active ? Math.round((done / active) * 100) : null,
  };
}
