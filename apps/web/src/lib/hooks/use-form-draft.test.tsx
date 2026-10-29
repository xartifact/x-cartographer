// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useFormDraft } from "./use-form-draft";
function Form({ version = "1" }: { version?: string }) {
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState("");
  const draft = useFormDraft({
    open,
    scope: "test:product:entity",
    values: { title },
    restore: (v) => setTitle(v.title),
    close: () => setOpen(false),
    version,
  });
  return open ? (
    <div>
      {draft.protection}
      <input aria-label="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button onClick={draft.requestClose}>关闭</button>
      <button
        onClick={() => {
          draft.clear();
          setOpen(false);
        }}
      >
        保存成功
      </button>
    </div>
  ) : (
    <p>已关闭</p>
  );
}
afterEach(() => {
  cleanup();
  localStorage.clear();
});
it("protects dirty dismissal and restores the complete retained draft after remount", async () => {
  const view = render(<Form />);
  await new Promise((r) => setTimeout(r, 20));
  fireEvent.change(screen.getByLabelText("标题"), { target: { value: "完整内容" } });
  fireEvent.click(screen.getByText("关闭"));
  expect(screen.getByText("保留未保存的修改？")).toBeTruthy();
  fireEvent.click(screen.getByText("继续编辑"));
  expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("完整内容");
  fireEvent.click(screen.getByText("关闭"));
  fireEvent.click(screen.getByText("保留草稿并关闭"));
  expect(screen.getByText("已关闭")).toBeTruthy();
  view.unmount();
  render(<Form version="2" />);
  await waitFor(() => expect(screen.getByText(/服务端内容已更新/)).toBeTruthy());
  expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("");
  fireEvent.click(screen.getByText("恢复草稿"));
  expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("完整内容");
  fireEvent.click(screen.getByText("保存成功"));
  expect(localStorage.length).toBe(0);
});
it("explicit discard removes the persisted draft", async () => {
  render(<Form />);
  await new Promise((r) => setTimeout(r, 20));
  fireEvent.change(screen.getByLabelText("标题"), { target: { value: "放弃内容" } });
  fireEvent.click(screen.getByText("关闭"));
  fireEvent.click(screen.getByText("放弃修改"));
  expect(screen.getByText("已关闭")).toBeTruthy();
  expect(localStorage.length).toBe(0);
});
it("does not overwrite the form with a malformed persisted draft", async () => {
  localStorage.setItem(
    `xcart-form:${location.origin}:test:product:entity`,
    JSON.stringify({ values: { title: 123 } }),
  );
  render(<Form />);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("草稿无法读取"));
  expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("");
});
