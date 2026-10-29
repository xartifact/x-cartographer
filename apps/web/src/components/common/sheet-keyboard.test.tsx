// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@x-cartographer/ui";
function Example() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>打开任务</button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetTitle>任务详情</SheetTitle>
          <SheetDescription>验收键盘焦点</SheetDescription>
          <button>编辑</button>
        </SheetContent>
      </Sheet>
    </>
  );
}
afterEach(cleanup);
it("returns keyboard focus to a custom opener after Escape closes a controlled detail sheet", async () => {
  render(<Example />);
  const opener = screen.getByRole("button", { name: "打开任务" });
  opener.focus();
  fireEvent.click(opener);
  await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(opener));
});
