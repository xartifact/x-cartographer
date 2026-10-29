// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TaskCreateDialog } from "./task-create-dialog";
import type { Product } from "@/types";
vi.mock("@/lib/api/hooks", () => ({
  useSystemModules: () => ({ data: [{ id: "web", name: "Web 前端" }] }),
}));
const product = {
  id: "P",
  user_activities: [{ id: "A", name: "发现商品", stories: [{ id: "S", title: "搜索商品" }] }],
} as Product;
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it("keeps the task form open and preserves input after a rejected save", async () => {
  const close = vi.fn();
  const save = vi.fn().mockRejectedValue(new Error("服务暂不可用"));
  render(<TaskCreateDialog open onOpenChange={close} project={product} onSave={save} />);
  fireEvent.change(screen.getByLabelText(/所属活动/), { target: { value: "A" } });
  fireEvent.change(screen.getByLabelText(/所属故事/), { target: { value: "S" } });
  fireEvent.change(screen.getByLabelText(/任务标题/), { target: { value: "保留这个标题" } });
  fireEvent.click(screen.getByRole("button", { name: "创建任务" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("服务暂不可用"));
  expect(close).not.toHaveBeenCalled();
  expect((screen.getByLabelText(/任务标题/) as HTMLInputElement).value).toBe("保留这个标题");
});
it("creates a module anchored task without demanding a story", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn();
  render(<TaskCreateDialog open onOpenChange={close} project={product} onSave={save} />);
  fireEvent.change(screen.getByLabelText("任务归属"), { target: { value: "module" } });
  fireEvent.change(screen.getByLabelText("所属模块"), { target: { value: "web" } });
  fireEvent.change(screen.getByLabelText(/任务标题/), { target: { value: "维护基础设施" } });
  fireEvent.click(screen.getByRole("button", { name: "创建任务" }));
  await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  expect(save.mock.calls[0][0]).toMatchObject({ moduleId: "web", title: "维护基础设施" });
  expect(save.mock.calls[0][0].storyId).toBeUndefined();
});
