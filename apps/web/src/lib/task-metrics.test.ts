import { TaskStatus } from "@/types";
import { expect, it } from "vitest";
import { taskMetrics } from "./task-metrics";
it("uses valid work as the completion denominator and keeps cancellations visible", () => {
  expect(
    taskMetrics([
      { status: TaskStatus.DONE },
      { status: TaskStatus.TODO },
      { status: TaskStatus.CANCELLED },
    ]),
  ).toEqual({ total: 3, active: 2, cancelled: 1, done: 1, percent: 50 });
  expect(taskMetrics([{ status: TaskStatus.CANCELLED }]).percent).toBeNull();
});
