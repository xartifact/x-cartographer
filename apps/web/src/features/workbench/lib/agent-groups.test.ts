import { expect, it } from "vitest";
import type { ActiveAgentTask } from "@x-cartographer/shared";
import { groupAgentTasks, claimDuration } from "./agent-groups";
const task = (id: string, agent: string, session: string, time: string) =>
  ({ id, claim_agent_id: agent, claim_session_id: session, claimed_at: time }) as ActiveAgentTask;
it("groups exact Agent/session pairs and orders groups by latest claim, tasks by oldest claim without mutating input", () => {
  const tasks = [
    task("old", "codex", "same", "2026-10-29T01:00:00Z"),
    task("other", "claude", "same", "2026-10-29T02:00:00Z"),
    task("new", "codex", "same", "2026-10-29T03:00:00Z"),
    task("another", "codex", "other", "2026-10-29T04:00:00Z"),
  ];
  const groups = groupAgentTasks(tasks);
  expect(groups.map((g) => g.id)).toEqual(["codex", "claude"]);
  expect(groups[0].sessions.map((s) => s.id)).toEqual(["other", "same"]);
  expect(groups[0].sessions[1].tasks.map((t) => t.id)).toEqual(["old", "new"]);
  expect(tasks.map((t) => t.id)).toEqual(["old", "other", "new", "another"]);
});
it("shows elapsed claim age without treating long work as expired or online", () => {
  const start = "2026-10-29T01:00:00Z";
  const now = Date.parse(start);
  expect(claimDuration(start, now)).toBe("不足 1 分钟");
  expect(claimDuration(start, now + 65 * 60000)).toBe("1 小时 5 分钟");
  expect(claimDuration(start, now + 2 * 86400000)).toBe("2 天 0 小时");
});
