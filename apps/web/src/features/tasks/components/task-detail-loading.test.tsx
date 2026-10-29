// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TaskStatus, TaskPriority, type DevTask } from "@x-cartographer/shared";
import { TaskDetailSheet } from "./task-detail-sheet";
vi.mock("./status-history", () => ({ StatusHistory: () => null }));
vi.mock("@/components/common/entity-status-control", () => ({ EntityStatusControl: () => null }));
const task: DevTask = {
  id: "T",
  title: "执行任务",
  description: "",
  status: TaskStatus.IN_PROGRESS,
  priority: TaskPriority.P1,
  estimation: 1,
  story_id: "S",
  dependencies: [],
  tags: [],
  created_at: "2026-10-29T00:00:00Z",
  updated_at: "2026-10-29T00:00:00Z",
};
function Example({ loaded }: { loaded: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>查看任务</button>
      <TaskDetailSheet
        open={open}
        onOpenChange={setOpen}
        task={loaded ? task : null}
        allTasks={[]}
        loadingMessage="读取中"
        storyContextMap={{ S: { storyTitle: "故事", activityName: "活动" } }}
      />
    </>
  );
}
afterEach(cleanup);
it("keeps one dialog through loading and restores the original keyboard opener after closing loaded content", async () => {
  const view = render(<Example loaded={false} />);
  const opener = screen.getByRole("button", { name: "查看任务" });
  opener.focus();
  fireEvent.click(opener);
  await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
  const dialog = screen.getByRole("dialog");
  view.rerender(<Example loaded />);
  await waitFor(() => expect(screen.getByRole("heading", { name: "执行任务" })).toBeTruthy());
  expect(screen.getByRole("dialog")).toBe(dialog);
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(opener));
});
