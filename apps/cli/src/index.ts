#!/usr/bin/env bun
// @xpm/cli - X-Cartographer 命令行接口
// 调 gateway REST API（与 MCP server 同模式）
//
// 用法:
//   xpm projects                         列出项目
//   xpm project <id>                     项目详情
//   xpm milestones <projectId>           版本列表
//   xpm create-milestone <projectId> <name> [--goal <text>] [--date <iso>]
//   xpm story-status <storyId> <status>  更新故事状态
//   xpm task-status <taskId> <status>    更新任务状态
//   xpm export-context <projectId>       导出项目全景上下文（Markdown）
//
// 环境变量:
//   XPM_API_URL    gateway 地址（默认 http://localhost:8787）
//   XPM_API_TOKEN  API Token（若 gateway 启用认证）
//   --json         输出 JSON（脚本解析）

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

// ─── 类型 ────────────────────────────────────────────────────

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

function isProjectArray(d: unknown): d is ProjectJson[] {
  return Array.isArray(d);
}
function isProject(d: unknown): d is ProjectJson {
  return typeof d === 'object' && d !== null && 'id' in d;
}
function isMilestoneArray(d: unknown): d is MilestoneJson[] {
  return Array.isArray(d);
}

const JSON_OUTPUT = process.argv.includes('--json');
function out(data: unknown) {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

// ─── 命令实现 ────────────────────────────────────────────────

async function cmdProjects() {
  const data = await api('/api/projects');
  const projects = isProjectArray(data) ? data : [];
  out(
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      journeys: p.user_journeys?.length ?? 0,
    }))
  );
}

async function cmdProject(id: string) {
  const data = await api(`/api/projects/${id}`);
  if (!isProject(data)) {
    throw new Error(`项目不存在: ${id}`);
  }
  const milestoneData = await api(`/api/milestones?projectId=${id}`);
  const milestones = isMilestoneArray(milestoneData) ? milestoneData : [];
  out({
    id: data.id,
    name: data.name,
    description: data.description ?? '',
    milestones: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      target_date: m.target_date,
    })),
    journeys: (data.user_journeys ?? []).map((j) => ({
      id: j.id,
      name: j.name,
      stories: (j.stories ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status ?? 'backlog',
        milestone_id: s.milestone_id ?? null,
      })),
    })),
  });
}

async function cmdMilestones(projectId: string) {
  const data = await api(`/api/milestones?projectId=${projectId}`);
  const milestones = isMilestoneArray(data) ? data : [];
  out(milestones.map((m) => ({ id: m.id, name: m.name, status: m.status, target_date: m.target_date })));
}

async function cmdCreateMilestone(projectId: string, name: string) {
  const goalIdx = process.argv.indexOf('--goal');
  const dateIdx = process.argv.indexOf('--date');
  const goal = goalIdx >= 0 ? process.argv[goalIdx + 1] : undefined;
  const targetDate = dateIdx >= 0 ? process.argv[dateIdx + 1] : undefined;
  const result = (await api('/api/milestones', {
    method: 'POST',
    body: { project_id: projectId, name, goal, target_date: targetDate },
  })) as { id: string };
  out({ success: true, id: result.id, name });
}

async function cmdStoryStatus(storyId: string, status: string) {
  await api(`/api/stories/${storyId}/status`, { method: 'POST', body: { status } });
  out({ success: true, story_id: storyId, status });
}

async function cmdTaskStatus(taskId: string, status: string) {
  await api(`/api/tasks/${taskId}/status`, { method: 'POST', body: { status } });
  out({ success: true, task_id: taskId, status });
}

// ─── 上下文导出 ──────────────────────────────────────────────

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    backlog: '待规划',
    todo: '待办',
    in_progress: '进行中',
    in_review: '评审中',
    testing: '测试中',
    done: '已完成',
    cancelled: '已取消',
  };
  return map[s] ?? s;
}

function priorityLabel(p: string): string {
  const map: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };
  return map[p] ?? p;
}

async function cmdExportContext(projectId: string) {
  const data = await api(`/api/projects/${projectId}`);
  if (!isProject(data)) {
    throw new Error(`项目不存在: ${projectId}`);
  }
  const milestoneData = await api(`/api/milestones?projectId=${projectId}`);
  const milestones = isMilestoneArray(milestoneData) ? milestoneData : [];

  const journeys = data.user_journeys ?? [];
  const stories = journeys.flatMap((j) => j.stories ?? []);
  const tasks = stories.flatMap((s) => s.tasks ?? []);
  const totalEst = tasks.reduce((a, t) => a + (t.estimation || 0), 0);
  const doneTasks = tasks.filter((t) => t.status === 'done').length;

  const lines: string[] = [];
  lines.push(`# ${data.name} — 项目全景`);
  lines.push('');
  lines.push(`> 描述：${data.description ?? '（无）'}`);
  lines.push('');
  lines.push('## 概览');
  lines.push('');
  lines.push(`- 用户旅程：${journeys.length} 个`);
  lines.push(`- 用户故事：${stories.length} 个`);
  lines.push(`- 任务总数：${tasks.length} 个（已完成 ${doneTasks}，${doneTasks / Math.max(tasks.length, 1) * 100 | 0}%）`);
  lines.push(`- 总估算工时：${totalEst} 小时`);
  lines.push('');
  lines.push('## 版本（里程碑）');
  lines.push('');
  if (milestones.length === 0) {
    lines.push('（暂无版本）');
  } else {
    for (const m of milestones) {
      const milestoneStories = stories.filter((s) => s.milestone_id === m.id);
      const est = milestoneStories.reduce((a, s) => a + (s.estimation || 0), 0);
      lines.push(`### ${m.name}（${statusLabel(m.status)}）`);
      if (m.target_date) lines.push(`- 目标日期：${m.target_date.slice(0, 10)}`);
      if (m.goal) lines.push(`- 目标：${m.goal}`);
      lines.push(`- 故事数：${milestoneStories.length}，估算：${est} 小时`);
      lines.push('');
    }
    const unplanned = stories.filter((s) => !s.milestone_id);
    if (unplanned.length > 0) {
      lines.push(`### 待规划池（${unplanned.length} 个故事，未排期）`);
      lines.push('');
    }
  }
  lines.push('## 用户旅程与故事');
  lines.push('');
  for (const j of journeys) {
    lines.push(`### ${j.name}（persona: ${j.persona}）`);
    lines.push('');
    for (const s of j.stories ?? []) {
      lines.push(`- **[${s.id}] ${s.title}**（${priorityLabel(s.priority)}优先级 · ${s.estimation}h · ${statusLabel(s.status ?? 'backlog')}${s.milestone_id ? ' · 已排期' : ' · 未排期'}）`);
      if (s.description) {
        lines.push(`  - ${s.description.split('\n')[0]}`);
      }
      if ((s.tasks ?? []).length > 0) {
        lines.push(`  - 任务（${s.tasks!.length}）：${s.tasks!.slice(0, 5).map((t) => `[${t.status}] ${t.title}`).join('；')}${s.tasks!.length > 5 ? '…' : ''}`);
      }
    }
    lines.push('');
  }
  lines.push('---');
  lines.push(`导出时间：${new Date().toISOString()}`);
  lines.push('');

  const md = lines.join('\n');
  out(md);
}

// ─── 入口 ────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--json');
  const cmd = args[0];

  try {
    switch (cmd) {
      case 'projects':
        await cmdProjects();
        break;
      case 'project':
        if (!args[1]) throw new Error('用法: xpm project <id>');
        await cmdProject(args[1]);
        break;
      case 'milestones':
        if (!args[1]) throw new Error('用法: xpm milestones <projectId>');
        await cmdMilestones(args[1]);
        break;
      case 'create-milestone':
        if (!args[1] || !args[2]) throw new Error('用法: xpm create-milestone <projectId> <name> [--goal] [--date]');
        await cmdCreateMilestone(args[1], args[2]);
        break;
      case 'story-status':
        if (!args[1] || !args[2]) throw new Error('用法: xpm story-status <storyId> <status>');
        await cmdStoryStatus(args[1], args[2]);
        break;
      case 'task-status':
        if (!args[1] || !args[2]) throw new Error('用法: xpm task-status <taskId> <status>');
        await cmdTaskStatus(args[1], args[2]);
        break;
      case 'export-context':
        if (!args[1]) throw new Error('用法: xpm export-context <projectId>');
        await cmdExportContext(args[1]);
        break;
      case 'help':
      case undefined:
      case '-h':
        console.log(helpText());
        break;
      default:
        throw new Error(`未知命令: ${cmd}\n\n${helpText()}`);
    }
  } catch (err) {
    console.error(`错误: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

function helpText(): string {
  return `X-Cartographer CLI

用法:
  xpm projects                            列出项目
  xpm project <id>                        项目详情
  xpm milestones <projectId>              版本列表
  xpm create-milestone <projectId> <name> 创建版本（--goal/--date）
  xpm story-status <storyId> <status>     更新故事状态
  xpm task-status <taskId> <status>       更新任务状态
  xpm export-context <projectId>          导出项目全景上下文

选项:
  --json    JSON 输出（脚本解析）
环境变量:
  XPM_API_URL    gateway 地址（默认 http://localhost:8787）
  XPM_API_TOKEN  API Token（gateway 启用认证时需要）`;
}

main();
