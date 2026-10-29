// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TaskStatus, TaskPriority, type ActiveAgentTask } from "@x-cartographer/shared";
import { WorkbenchPage } from "./workbench-page";
const state = vi.hoisted(() => ({
  result: {
    data: [] as ActiveAgentTask[],
    dataUpdatedAt: Date.parse("2026-10-29T05:00:00Z"),
    error: null as Error | null,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
  },
}));
vi.mock("@/lib/api/hooks", () => ({
  useActiveAgentTasks: () => state.result,
  useDevTask: () => ({ data: undefined }),
  useAllDevTasks: () => ({ data: undefined }),
}));
vi.mock("@/lib/hooks/use-url-state", async () => {
  const React = await import("react");
  return {
    useUrlState: () => {
      const [v, set] = React.useState("");
      return [v, (s: string | null) => set(s ?? "")];
    },
  };
});
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: any) => <a href={`/products/${params.productId}`}>{children}</a>,
}));
vi.mock("@/features/tasks/components/task-detail-sheet", () => ({ TaskDetailSheet: () => null }));
const task = (id: string, agent: string, session: string, product: string): ActiveAgentTask => ({
  id,
  title: `执行 ${id}`,
  status: TaskStatus.IN_PROGRESS,
  priority: TaskPriority.P1,
  description: "",
  estimation: 1,
  dependencies: [],
  story_id: null,
  module_id: "engine",
  tags: [],
  created_at: "2026-10-29T01:00:00Z",
  updated_at: "2026-10-29T01:00:00Z",
  claim_agent_id: agent,
  claim_session_id: session,
  claimed_at: "2026-10-29T01:00:00Z",
  product: { id: product, name: product },
  story: null,
});
beforeEach(() => {
  state.result.data = [
    task("T1", "codex", "session-1", "P1"),
    task("T2", "codex", "session-2", "P2"),
    task("T3", "claude", "session-1", "P1"),
  ];
  state.result.error = null;
  state.result.refetch.mockClear();
});
afterEach(cleanup);
it("groups Agent/session pairs, filters without changing global totals and provides no status or bulk controls", () => {
  render(<WorkbenchPage />);
  expect(screen.getByRole("region", { name: "Agent codex" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Agent claude" })).toBeTruthy();
  expect(screen.getAllByRole("region", { name: "会话 session-1" })).toHaveLength(2);
  expect(screen.getByText("匹配 3 / 3 项执行任务")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("筛选 Agent"), { target: { value: "claude" } });
  expect(screen.getByText("匹配 1 / 3 项执行任务")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Agent codex" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
  expect(screen.getByText("匹配 3 / 3 项执行任务")).toBeTruthy();
  expect(screen.queryByText("全部状态")).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
});
it("removes ended tasks on refreshed data, preserves stale results on error and offers retry", () => {
  const view = render(<WorkbenchPage />);
  state.result.data = state.result.data.filter((t) => t.id !== "T1");
  view.rerender(<WorkbenchPage />);
  expect(screen.queryByRole("button", { name: /查看任务 T1 / })).toBeNull();
  state.result.error = new Error("offline");
  view.rerender(<WorkbenchPage />);
  expect(screen.getByRole("alert").textContent).toContain("上次成功结果");
  expect(screen.getByRole("button", { name: /查看任务 T2 / })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  expect(state.result.refetch).toHaveBeenCalledOnce();
});
it("distinguishes an empty monitor from filter-empty and explains identity requirements", () => {
  const view = render(<WorkbenchPage />);
  fireEvent.change(screen.getByLabelText("搜索执行任务"), { target: { value: "missing" } });
  expect(screen.getByText("当前筛选没有匹配的执行任务，请调整或清除筛选。")).toBeTruthy();
  state.result.data = [];
  view.rerender(<WorkbenchPage />);
  expect(screen.getByText("当前没有 Agent 执行任务")).toBeTruthy();
  expect(screen.getByText(/xcart task claim TASK-XXX/)).toBeTruthy();
});
