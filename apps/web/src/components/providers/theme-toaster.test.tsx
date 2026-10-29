// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "next-themes";
import { toast } from "sonner";
import { ThemeToaster } from "./theme-toaster";

function AppearanceControls() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <>
      <output>
        {theme}:{resolvedTheme}
      </output>
      <button onClick={() => setTheme("light")}>light</button>
      <button onClick={() => setTheme("system")}>system</button>
    </>
  );
}
afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.restoreAllMocks();
  localStorage.removeItem("theme");
  document.documentElement.className = "";
});
it("keeps portals aligned with system changes, explicit overrides, persistence and cross-tab updates", async () => {
  localStorage.removeItem("theme");
  let dark = true;
  const listeners = new Set<(event: { matches: boolean }) => void>();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("prefers-color-scheme") && dark,
      media: query,
      addListener: (fn: (e: { matches: boolean }) => void) => listeners.add(fn),
      removeListener: (fn: (e: { matches: boolean }) => void) => listeners.delete(fn),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  const changeOS = (next: boolean) =>
    act(() => {
      dark = next;
      for (const fn of listeners) fn({ matches: dark });
    });
  const view = () =>
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AppearanceControls />
        <ThemeToaster />
      </ThemeProvider>,
    );
  let mounted = view();
  act(() => {
    toast("Theme verification", { duration: Infinity });
  });
  await waitFor(() => expect(screen.getByText("system:dark")).toBeTruthy());
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(document.querySelector("[data-sonner-toaster]")?.getAttribute("data-sonner-theme")).toBe(
    "dark",
  );
  changeOS(false);
  await waitFor(() => expect(screen.getByText("system:light")).toBeTruthy());
  act(() => screen.getByText("light", { selector: "button" }).click());
  changeOS(true);
  await waitFor(() => expect(screen.getByText("light:light")).toBeTruthy());
  expect(localStorage.getItem("theme")).toBe("light");
  mounted.unmount();
  mounted = view();
  act(() => {
    toast("Reload verification", { duration: Infinity });
  });
  await waitFor(() => expect(screen.getByText("light:light")).toBeTruthy());
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "theme", newValue: "dark" })));
  await waitFor(() => expect(screen.getByText("dark:dark")).toBeTruthy());
  expect(document.querySelector("[data-sonner-toaster]")?.getAttribute("data-sonner-theme")).toBe(
    "dark",
  );
  act(() => screen.getByText("system", { selector: "button" }).click());
  changeOS(false);
  await waitFor(() => expect(screen.getByText("system:light")).toBeTruthy());
  mounted.unmount();
});
