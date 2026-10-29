// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StoryTaskPanel } from "./story-task-panel";
import { Priority, TaskPriority, TaskStatus, type UserStory } from "@/types";
const mocks = vi.hoisted(() => ({ refetch: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/api/hooks", () => ({
  useAllDevTasks: () => ({ refetch: mocks.refetch }),
  useCreateDevTask: () => ({ mutateAsync: vi.fn() }),
  useUpdateDevTaskStatus: () => ({ mutateAsync: vi.fn() }),
  useDeleteDevTask: () => ({ mutateAsync: mocks.remove }),
}));
vi.mock("@/lib/hooks/use-virtual-list", () => ({
  useVirtualList: () => ({ start: 0, end: 1, totalHeight: 64, offsetY: 0 }),
}));
vi.mock("@/components/common/entity-status-control", () => ({ EntityStatusControl: () => null }));
const story: UserStory = {
  id: "S",
  title: "故事",
  description: "",
  priority: Priority.HIGH,
  estimation: 1,
  acceptance_criteria: [],
  tags: [],
  activity_id: "A",
  order: 0,
  created_at: "2026-10-29T00:00:00Z",
  updated_at: "2026-10-29T00:00:00Z",
  dev_tasks: [
    {
      id: "T",
      title: "待删除任务",
      description: "",
      dependencies: [],
      tags: [],
      priority: TaskPriority.P1,
      estimation: 1,
      status: TaskStatus.TODO,
      story_id: "S",
      created_at: "2026-10-29T00:00:00Z",
      updated_at: "2026-10-29T00:00:00Z",
    },
  ],
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it("lists dependent tasks before confirmation and does not delete when declined", async () => {
  mocks.refetch.mockResolvedValue({
    data: [{ id: "OTHER", title: "跨故事的后续任务", dependencies: ["T"] }],
  });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<StoryTaskPanel story={story} productId="P" />);
  fireEvent.click(screen.getByRole("button", { name: "删除研发任务 待删除任务" }));
  await waitFor(() => expect(confirm).toHaveBeenCalled());
  expect(confirm.mock.calls[0][0]).toContain("OTHER · 跨故事的后续任务");
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("does not offer deletion when impact lookup fails", async () => {
  mocks.refetch.mockResolvedValue({ error: new Error("offline") });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<StoryTaskPanel story={story} productId="P" />);
  fireEvent.click(screen.getByRole("button", { name: "删除研发任务 待删除任务" }));
  await waitFor(() => expect(mocks.refetch).toHaveBeenCalled());
  expect(confirm).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
