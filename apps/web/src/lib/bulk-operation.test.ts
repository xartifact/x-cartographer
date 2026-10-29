import { expect, it, vi } from "vitest";
import { runBulk } from "./bulk-operation";
it("retains only failed IDs so retry does not repeat successful writes", async () => {
  const write = vi.fn(async (id: string) => {
    if (id === "b") throw new Error("offline");
  });
  const result = await runBulk(["a", "b", "c"], write);
  expect(result).toEqual({ succeeded: ["a", "c"], failed: ["b"] });
  const retry = vi.fn(async () => {});
  expect(await runBulk(result.failed, retry)).toEqual({ succeeded: ["b"], failed: [] });
  expect(retry).toHaveBeenCalledTimes(1);
});
