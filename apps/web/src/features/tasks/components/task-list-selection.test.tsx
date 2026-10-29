// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { TaskList } from "./task-list";
import { TaskStatus, TaskPriority, type DevTask } from "@/types";
vi.mock("@/components/common/entity-status-control", () => ({ EntityStatusControl: () => null }));
const task = {
  id: "visible",
  title: "Visible task",
  description: "",
  status: TaskStatus.TODO,
  priority: TaskPriority.P1,
  estimation: 1,
  story_id: null,
  dependencies: [],
  tags: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as DevTask;
afterEach(cleanup);
it("selects only visible results while preserving hidden selections and obeying controlled resets", () => {
  const select = vi.fn();
  const props = { tasks: [task], onSelectionChange: select, showStatusFilter: false };
  const view = render(<TaskList {...props} selectedIds={["hidden"]} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "选择当前结果" }));
  expect(select).toHaveBeenLastCalledWith(["hidden", "visible"]);
  view.rerender(<TaskList {...props} selectedIds={["hidden", "visible"]} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "选择当前结果" }));
  expect(select).toHaveBeenLastCalledWith(["hidden"]);
  view.rerender(<TaskList {...props} selectedIds={[]} />);
  expect(screen.getByRole("checkbox", { name: "选择当前结果" }).getAttribute("aria-checked")).toBe(
    "false",
  );
});
