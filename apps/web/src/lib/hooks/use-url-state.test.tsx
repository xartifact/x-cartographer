// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useUrlState } from "./use-url-state";
afterEach(cleanup);
function View() {
  const [priority] = useUrlState("priority");
  const [status] = useUrlState("status");
  const [id, setId] = useUrlState("storyId");
  return (
    <>
      <output>
        {priority}:{status}:{id}
      </output>
      <button onClick={() => setId("S")}>打开故事</button>
    </>
  );
}
it("preserves filters when opening details and restores them on browser back and remount", async () => {
  const root = createRootRoute({ component: Outlet });
  const page = createRoute({ getParentRoute: () => root, path: "/", component: View });
  const history = createMemoryHistory({ initialEntries: ["/?priority=high&status=todo"] });
  const router = createRouter({ routeTree: root.addChildren([page]), history });
  const view = render(<RouterProvider router={router} />);
  await waitFor(() => expect(screen.getByText("high:todo:")).toBeTruthy());
  fireEvent.click(screen.getByText("打开故事"));
  await waitFor(() => expect(screen.getByText("high:todo:S")).toBeTruthy());
  history.back();
  await waitFor(() => expect(screen.getByText("high:todo:")).toBeTruthy());
  view.unmount();
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(screen.getByText("high:todo:")).toBeTruthy());
});
