// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useActiveAgentTasks } from "./use-dev-tasks";
const fetchActive = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  api: { api: { "dev-tasks": { active: { $get: fetchActive } } } },
}));
afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  vi.restoreAllMocks();
  fetchActive.mockReset();
});
it("polls every 15 seconds only while visible, refreshes on return, and retains last results on failure", async () => {
  vi.useFakeTimers();
  const rows = [{ id: "T1" }];
  fetchActive.mockResolvedValue({ ok: true, json: async () => rows });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const { result } = renderHook(
    () => {
      const query = useActiveAgentTasks();
      return { data: query.data, error: query.error };
    },
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5);
  });
  expect(result.current.data).toEqual(rows);
  expect(fetchActive).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_000);
  });
  expect(fetchActive).toHaveBeenCalledTimes(2);
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => {
    window.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(fetchActive).toHaveBeenCalledTimes(2);
  visibility.mockReturnValue("visible");
  fetchActive.mockRejectedValue(new Error("offline"));
  await act(async () => {
    window.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(5);
  });
  expect(fetchActive).toHaveBeenCalledTimes(3);
  expect(result.current.data).toEqual(rows);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5);
  });
  expect(result.current.error?.message).toBe("offline");
  client.clear();
});
