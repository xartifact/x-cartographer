import type { ActiveAgentTask } from "@x-cartographer/shared";
export interface AgentGroup {
  id: string;
  latest: number;
  sessions: { id: string; latest: number; tasks: ActiveAgentTask[] }[];
}
export function groupAgentTasks(tasks: ActiveAgentTask[]): AgentGroup[] {
  const agents = new Map<string, Map<string, ActiveAgentTask[]>>();
  for (const task of tasks) {
    const sessions = agents.get(task.claim_agent_id) ?? new Map<string, ActiveAgentTask[]>();
    const rows = sessions.get(task.claim_session_id) ?? [];
    rows.push(task);
    sessions.set(task.claim_session_id, rows);
    agents.set(task.claim_agent_id, sessions);
  }
  return [...agents]
    .map(([id, sessions]) => {
      const groups = [...sessions]
        .map(([sessionId, rows]) => ({
          id: sessionId,
          latest: Math.max(...rows.map((t) => Date.parse(t.claimed_at))),
          tasks: [...rows].sort(
            (a, b) =>
              Date.parse(a.claimed_at) - Date.parse(b.claimed_at) || a.id.localeCompare(b.id),
          ),
        }))
        .sort((a, b) => b.latest - a.latest || a.id.localeCompare(b.id));
      return { id, latest: groups[0].latest, sessions: groups };
    })
    .sort((a, b) => b.latest - a.latest || a.id.localeCompare(b.id));
}
export function claimDuration(claimedAt: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(claimedAt)) / 60000));
  if (minutes < 1) return "不足 1 分钟";
  if (minutes < 60) return `${minutes} 分钟`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
  return `${Math.floor(minutes / 1440)} 天 ${Math.floor((minutes % 1440) / 60)} 小时`;
}
