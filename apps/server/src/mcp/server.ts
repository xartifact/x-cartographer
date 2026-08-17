// MCP Server：让 AI 代理（Claude Code 等）通过 MCP 协议读写 X-Cartographer 数据
// 传输层：stdio（AI 代理本地启动子进程连接）
// 数据层：通过 HTTP 调用 gateway REST API（避免与 gateway 共享 PGlite 文件库的冲突）
//
// 用法：
//   - 直接运行: bun run src/mcp/server.ts
//   - 配置到 Claude Code: mcpServers: { "x-cartographer": { command: "bun", args: ["run", "src/mcp/server.ts"], cwd: "<repo>/apps/server" } }
//
// 环境变量：
//   XPM_API_URL - gateway 地址（默认 http://localhost:8787）
//   XPM_API_TOKEN - API Token（若 gateway 已启用认证；未配置时无需）

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_URL = process.env.XPM_API_URL ?? 'http://localhost:8787';
const API_TOKEN = process.env.XPM_API_TOKEN ?? '';

async function api(path: string, options: { method?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_TOKEN) headers['Authorization'] = `Bearer ${API_TOKEN}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<unknown>;
}

// ─── API 响应类型 ─────────────────────────────────────────────

interface TaskJson {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  estimation: number;
}

interface StoryJson {
  id: string;
  title: string;
  description: string;
  priority: string;
  estimation: number;
  status?: string;
  milestone_id?: string | null;
  tasks?: TaskJson[];
}

interface JourneyJson {
  id: string;
  name: string;
  description: string;
  persona: string;
  stories?: StoryJson[];
}

interface ProjectJson {
  id: string;
  name: string;
  description?: string | null;
  user_journeys?: JourneyJson[];
}

interface MilestoneJson {
  id: string;
  name: string;
  goal: string;
  status: string;
  target_date?: string;
}

function toText(data: unknown): { type: 'text'; text: string } {
  return { type: 'text', text: JSON.stringify(data, null, 2) };
}

function isProjectArray(data: unknown): data is ProjectJson[] {
  return Array.isArray(data);
}

function isProject(data: unknown): data is ProjectJson {
  return typeof data === 'object' && data !== null && 'id' in data;
}

function isMilestoneArray(data: unknown): data is MilestoneJson[] {
  return Array.isArray(data);
}

const server = new McpServer({
  name: 'x-cartographer',
  version: '0.1.0',
});

// ─── 查询工具 ───────────────────────────────────────────────

server.tool(
  'list_projects',
  '列出所有项目（含旅程/故事统计）',
  {},
  async () => {
    const data = await api('/api/projects');
    const projects = isProjectArray(data) ? data : [];
    return {
      content: [
        toText(
          projects.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description ?? '',
            journey_count: p.user_journeys?.length ?? 0,
          }))
        ),
      ],
    };
  }
);

server.tool(
  'get_project',
  '查看项目详情：全部旅程、故事、任务与版本信息',
  { projectId: z.string().describe('项目 ID') },
  async ({ projectId }) => {
    const projectData = await api(`/api/projects/${projectId}`);
    if (!isProject(projectData)) {
      return { content: [{ type: 'text', text: `项目不存在或响应异常: ${projectId}` }] };
    }
    const milestoneData = await api(`/api/milestones?projectId=${projectId}`);
    const milestones = isMilestoneArray(milestoneData) ? milestoneData : [];
    return {
      content: [
        toText({
          id: projectData.id,
          name: projectData.name,
          description: projectData.description ?? '',
          milestones: milestones.map((m) => ({
            id: m.id,
            name: m.name,
            goal: m.goal,
            status: m.status,
            target_date: m.target_date,
          })),
          journeys: (projectData.user_journeys ?? []).map((j) => ({
            id: j.id,
            name: j.name,
            description: j.description,
            persona: j.persona,
            stories: (j.stories ?? []).map((s) => ({
              id: s.id,
              title: s.title,
              description: s.description,
              priority: s.priority,
              estimation: s.estimation,
              status: s.status ?? 'backlog',
              milestone_id: s.milestone_id ?? null,
              tasks: (s.tasks ?? []).map((t) => ({
                id: t.id,
                title: t.title,
                type: t.type,
                priority: t.priority,
                status: t.status,
                estimation: t.estimation,
              })),
            })),
          })),
        }),
      ],
    };
  }
);

server.tool(
  'list_milestones',
  '列出项目的版本（里程碑）',
  { projectId: z.string().describe('项目 ID') },
  async ({ projectId }) => {
    const data = await api(`/api/milestones?projectId=${projectId}`);
    const milestones = isMilestoneArray(data) ? data : [];
    return {
      content: milestones.map((m) =>
        toText({ id: m.id, name: m.name, goal: m.goal, status: m.status, target_date: m.target_date })
      ),
    };
  }
);

// ─── 更新工具 ───────────────────────────────────────────────

server.tool(
  'update_story_milestone',
  '将用户故事排入/移出版本（milestone）。传 null 取消排期（回待规划池）',
  {
    storyId: z.string().describe('故事 ID'),
    milestoneId: z.string().nullable().describe('版本 ID，null 表示取消排期'),
  },
  async ({ storyId, milestoneId }) => {
    await api(`/api/stories/${storyId}`, { method: 'PATCH', body: { milestoneId } });
    return {
      content: [
        {
          type: 'text',
          text: `故事 ${storyId} 已${milestoneId ? `排入版本 ${milestoneId}` : '取消排期（回待规划池）'}`,
        },
      ],
    };
  }
);

server.tool(
  'update_story_status',
  '更新用户故事状态（backlog/todo/in_progress/done/cancelled）',
  {
    storyId: z.string().describe('故事 ID'),
    status: z.enum(['backlog', 'todo', 'in_progress', 'done', 'cancelled']),
  },
  async ({ storyId, status }) => {
    await api(`/api/stories/${storyId}/status`, { method: 'POST', body: { status } });
    return { content: [{ type: 'text', text: `故事 ${storyId} 状态已更新为 ${status}` }] };
  }
);

server.tool(
  'update_task_status',
  '更新任务状态（backlog/todo/in_progress/in_review/testing/done/cancelled）',
  {
    taskId: z.string().describe('任务 ID'),
    status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'testing', 'done', 'cancelled']),
  },
  async ({ taskId, status }) => {
    await api(`/api/tasks/${taskId}/status`, { method: 'POST', body: { status } });
    return { content: [{ type: 'text', text: `任务 ${taskId} 状态已更新为 ${status}` }] };
  }
);

server.tool(
  'create_milestone',
  '创建版本（里程碑）',
  {
    projectId: z.string().describe('项目 ID'),
    name: z.string().describe('版本名称，如 v1.0'),
    goal: z.string().optional().describe('版本目标'),
    targetDate: z.string().optional().describe('目标日期 ISO'),
  },
  async ({ projectId, name, goal, targetDate }) => {
    const result = (await api('/api/milestones', {
      method: 'POST',
      body: { project_id: projectId, name, goal, target_date: targetDate },
    })) as { id: string };
    return { content: [{ type: 'text', text: `版本 ${name} 已创建: ${result.id}` }] };
  }
);

// ─── 启动 ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
