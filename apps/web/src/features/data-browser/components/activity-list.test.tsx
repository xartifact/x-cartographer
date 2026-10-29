// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ActivityList } from "./activity-list";
import type { UserActivity } from "@/types";
afterEach(cleanup);
it("expands and collapses an activity with Space and Enter without losing keyboard focus", () => {
  render(
    <ActivityList
      activities={[
        {
          id: "A",
          name: "发现商品",
          order: 0,
          stories: [],
          description: "",
          product_id: "P",
          created_at: "2026-10-29",
          updated_at: "2026-10-29",
        } as UserActivity,
      ]}
    />,
  );
  const header = screen.getByRole("button", { name: "展开或收起活动 发现商品" });
  header.focus();
  fireEvent.keyDown(header, { key: " " });
  expect(header.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("该活动下暂无用户故事")).toBeTruthy();
  fireEvent.keyDown(header, { key: "Enter" });
  expect(header.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(header);
});
