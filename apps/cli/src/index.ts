#!/usr/bin/env bun
/**
 * @x-cartographer/cli — X-Cartographer 命令行接口 (xcart)
 *
 * 面向 coding agent / 脚本 / 终端用户。通过 HTTP 调用 gateway REST API 操作
 * 用户故事地图与任务管理数据。
 *
 * 用法（嵌套子命令 + GNU flag 风格）:
 *   xcart project list | info | create | update | delete
 *   xcart journey list | info | create | update | delete
 *   xcart story  list | info | create | update | status | delete | bulk-create
 *   xcart task   list | info | create | update | status | delete | next | summary | bulk-create
 *   xcart milestone list | create | update | delete
 *   xcart status history <entityId> | all
 *   xcart context export <projectId>      (兼容别名: xcart export-context <id>)
 *   xcart overview --project <id>
 *   xcart skill install | list
 *
 * 全局选项（放在任意位置均可）:
 *   --server, -s <url>      gateway 地址（默认 $XCART_API_URL 或 http://localhost:8787）
 *   --token,  -t <token>    API Token（默认 $XCART_API_TOKEN；gateway 启用认证时需要）
 *   --format, -f <fmt>      输出格式: table | json | markdown（默认 table；overview/context 恒为 markdown）
 *   --help, -h              帮助
 *   --version, -v           版本
 */

const VERSION = '0.2.0';
const DEFAULT_SERVER = 'http://localhost:8787';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ─── 配置文件 ─────────────────────────────────────────────────
// 路径：$XDG_CONFIG_HOME/xcart/config 或 ~/.config/xcart/config
// 格式：key=value 每行一个，支持 # 注释与空行
const CONFIG_PATH = join(
  process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
  'xcart',
  'config',
);

function loadConfig(): Record<string, string> {
  if (!existsSync(CONFIG_PATH)) return {};
  const out: Record<string, string> = {};
  for (const raw of readFileSync(CONFIG_PATH, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

const config = loadConfig();

// ─── 参数解析 ─────────────────────────────────────────────────
interface ParsedArgs {
  flags: Map<string, string>;
  boolFlags: Set<string>;
  positional: string[];
}
function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Map<string, string>();
  const boolFlags = new Set<string>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags.set(a.slice(2, eq), a.slice(eq + 1));
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        flags.set(a.slice(2), argv[++i]);
      } else {
        boolFlags.add(a.slice(2));
      }
    } else if (a.startsWith('-') && a.length === 2) {
      const alias: Record<string, string> = { s: 'server', t: 'token', f: 'format' };
      const key = alias[a[1]];
      if (key) {
        if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) flags.set(key, argv[++i]);
        else boolFlags.add(key);
      } else {
        boolFlags.add(a.slice(1));
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, boolFlags, positional };
}
let server = config.server ?? process.env.XCART_API_URL ?? DEFAULT_SERVER;
let token = config.token ?? process.env.XCART_API_TOKEN ?? '';

async function api(path: string, method = 'GET', body?: unknown): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${server}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`API ${method} ${path} → ${res.status}: ${detail.slice(0, 300)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── 输出 ─────────────────────────────────────────────────────
type Format = 'table' | 'json' | 'markdown';
function alignTable(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '(empty)';
  const keys = Object.keys(rows[0]);
  const pad = (k: string, v: string) => v ?? '';
  const widths = keys.map((k) => Math.max(k.length, ...rows.map((r) => String(pad(k, String((r as any)[k] ?? ''))).length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  const sep = keys.map((_, i) => '-'.repeat(widths[i])).join('--');
  const out = [line(keys), sep];
  for (const r of rows) out.push(line(keys.map((k) => String((r as any)[k] ?? ''))));
  return out.join('\n');
}
function render(data: unknown, fmt: Format): string {
  if (fmt === 'json') return JSON.stringify(data, null, 2);
  if (fmt === 'markdown') {
    if (Array.isArray(data) && data.length && typeof data[0] === 'object') {
      const rows = data as Record<string, unknown>[];
      const keys = Object.keys(rows[0]);
      const head = `| ${keys.join(' | ')} |`;
      const sep = `| ${keys.map(() => '---').join(' | ')} |`;
      const body = rows.map((r) => `| ${keys.map((k) => String((r as any)[k] ?? '')).join(' | ')} |`);
      return [head, sep, ...body].join('\n');
    }
    return String(data);
  }
  if (Array.isArray(data) && data.length && typeof data[0] === 'object') {
    return alignTable(data as Record<string, unknown>[]);
  }
  if (data && typeof data === 'object') return JSON.stringify(data, null, 2);
  return String(data);
}

// ─── 辅助 ─────────────────────────────────────────────────────
function req(flags: ParsedArgs['flags'], ...names: string[]): string {
  for (const n of names) {
    const v = flags.get(n);
    if (v !== undefined) return v;
  }
  throw new Error(`缺少参数 --${names[0]}`);
}
function opt(flags: ParsedArgs['flags'], ...names: string[]): string | undefined {
  for (const n of names) {
    const v = flags.get(n);
    if (v !== undefined) return v;
  }
  return undefined;
}
function splitList(s: string | undefined): string[] | undefined {
  if (s === undefined) return undefined;
  return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
}
function reqId(positional: string[], action: string): string {
  const id = positional[0];
  if (!id) throw new Error(`用法: xcart ${action} <id>`);
  return id;
}
function isObj(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null;
}

// ─── 命令实现 ─────────────────────────────────────────────────
type Ctx = { flags: Map<string, string>; format: Format; positional: string[] };

// ---------- project ----------
async function cmdProject(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0];
  const f = ctx.flags;
  switch (sub) {
    case 'list': {
      const data = await api('/api/projects');
      const trim = (s: unknown, n: number) =>
        typeof s === 'string' && s.length > n ? s.slice(0, n) + '…' : (typeof s === 'string' ? s : '');
      const rows = (Array.isArray(data) ? data : []).map((p) => ({
        id: (p && typeof p === 'object' && 'id' in p && typeof p.id === 'string') ? p.id : '?',
        name: trim(p && typeof p === 'object' && 'name' in p ? p.name : '', 40),
        description: trim(p && typeof p === 'object' && 'description' in p ? p.description : '', 60),
        journeys: p && typeof p === 'object' && 'user_journeys' in p && Array.isArray(p.user_journeys) ? p.user_journeys.length : 0,
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'info': {
      const id = opt(f, 'id', 'project') ?? ctx.positional[1];
      if (!id) throw new Error('用法: xcart project info --id <id>');
      const data = await api(`/api/projects/${id}`);
      console.log(render(data, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'create': {
      const body: Record<string, unknown> = { name: req(f, 'name') };
      const desc = opt(f, 'description'); if (desc !== undefined) body.description = desc;
      const tech = splitList(opt(f, 'tech-stack', 'techStack')); if (tech) body.tech_stack = tech;
      const wd = opt(f, 'workspace-dir', 'workspaceDir'); if (wd !== undefined) body.workspace_dir = wd;
      const data = await api('/api/projects', 'POST', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'update': {
      const id = reqId(ctx.positional.slice(1), 'project update');
      const body: Record<string, unknown> = {};
      const name = opt(f, 'name'); if (name !== undefined) body.name = name;
      const desc = opt(f, 'description'); if (desc !== undefined) body.description = desc;
      const data = await api(`/api/projects/${id}`, 'PATCH', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'delete': {
      const id = reqId(ctx.positional.slice(1), 'project delete');
      const res = await api(`/api/projects/${id}`, 'DELETE');
      console.log(render(res, ctx.format));
      break;
    }
    default: throw new Error(`未知子命令: project ${sub ?? ''}\n\n${helpText()}`);
  }
}

// ---------- journey ----------
async function cmdJourney(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0];
  const f = ctx.flags;
  switch (sub) {
    case 'list': {
      const projectId = req(f, 'project', 'projectId');
      const data = await api(`/api/journeys?projectId=${encodeURIComponent(projectId)}`);
      const rows = (Array.isArray(data) ? data : []).map((j) => ({
        id: j.id, name: j.name, persona: j.persona, description: j.description ?? '', stories: j.stories?.length ?? 0,
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'info': {
      const id = reqId(ctx.positional.slice(1), 'journey info');
      const data = await api(`/api/stories?journeyId=${encodeURIComponent(id)}`);
      console.log(render({ journey_id: id, stories: Array.isArray(data) ? data : [] }, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'create': {
      const body = {
        projectId: req(f, 'project', 'projectId'),
        name: req(f, 'name'),
        description: opt(f, 'description') ?? '',
        persona: opt(f, 'persona') ?? '',
      };
      const data = await api('/api/journeys', 'POST', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'update': {
      const id = reqId(ctx.positional.slice(1), 'journey update');
      const body: Record<string, unknown> = {};
      const name = opt(f, 'name'); if (name !== undefined) body.name = name;
      const desc = opt(f, 'description'); if (desc !== undefined) body.description = desc;
      const persona = opt(f, 'persona'); if (persona !== undefined) body.persona = persona;
      const order = opt(f, 'order'); if (order !== undefined) body.order = Number(order);
      const data = await api(`/api/journeys/${id}`, 'PATCH', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'delete': {
      const id = reqId(ctx.positional.slice(1), 'journey delete');
      const res = await api(`/api/journeys/${id}`, 'DELETE');
      console.log(render(res, ctx.format));
      break;
    }
    default: throw new Error(`未知子命令: journey ${sub ?? ''}\n\n${helpText()}`);
  }
}

// ---------- story ----------
async function cmdStory(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0];
  const f = ctx.flags;
  switch (sub) {
    case 'list': {
      const journeyId = opt(f, 'journey', 'journeyId');
      if (!journeyId) throw new Error('用法: xcart story list --journey <id>');
      const data = await api(`/api/stories?journeyId=${encodeURIComponent(journeyId)}`);
      const rows = (Array.isArray(data) ? data : []).map((s) => ({
        id: s.id, title: s.title, priority: s.priority, status: s.status ?? '', estimation: s.estimation, milestone: s.milestone_id ?? '',
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'info': {
      const id = reqId(ctx.positional.slice(1), 'story info');
      const data = await api(`/api/stories/${id}`);
      const tasks = await api(`/api/tasks?storyId=${encodeURIComponent(id)}`).catch(() => []);
      const out = { ...data, tasks: Array.isArray(tasks) ? tasks : [] };
      console.log(render(out, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'create': {
      const body: Record<string, unknown> = {
        journeyId: req(f, 'journey', 'journeyId'),
        title: req(f, 'title'),
      };
      const desc = opt(f, 'description'); if (desc !== undefined) body.description = desc;
      body.priority = opt(f, 'priority') ?? 'medium';
      const est = opt(f, 'estimation'); if (est !== undefined) body.estimation = Number(est);
      const ac = splitList(opt(f, 'ac', 'acceptance')); if (ac) body.acceptanceCriteria = ac;
      const tags = splitList(opt(f, 'tags')); if (tags) body.tags = tags;
      const data = await api('/api/stories', 'POST', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'update': {
      const id = reqId(ctx.positional.slice(1), 'story update');
      const body: Record<string, unknown> = {};
      const title = opt(f, 'title'); if (title !== undefined) body.title = title;
      const desc = opt(f, 'description'); if (desc !== undefined) body.description = desc;
      const priority = opt(f, 'priority'); if (priority !== undefined) body.priority = priority;
      const est = opt(f, 'estimation'); if (est !== undefined) body.estimation = Number(est);
      const ac = splitList(opt(f, 'ac', 'acceptance')); if (ac) body.acceptanceCriteria = ac;
      const tags = splitList(opt(f, 'tags')); if (tags) body.tags = tags;
      const milestone = opt(f, 'milestone');
      if (milestone !== undefined) body.milestoneId = milestone === 'none' ? null : milestone;
      const status = opt(f, 'status');
      if (status !== undefined) {
        const res = await api(`/api/stories/${id}/status`, 'POST', { status, reason: opt(f, 'reason') });
        if (Object.keys(body).length === 0) { console.log(render(res, ctx.format)); return; }
      }
      const data = await api(`/api/stories/${id}`, 'PATCH', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'status': {
      const id = reqId(ctx.positional.slice(1), 'story status <id> <status>');
      const status = ctx.positional[2];
      if (!status) throw new Error('用法: xcart story status <id> <status> [--reason]');
      const res = await api(`/api/stories/${id}/status`, 'POST', { status, reason: opt(f, 'reason') });
      console.log(render(res, ctx.format));
      break;
    }
    case 'delete': {
      const id = reqId(ctx.positional.slice(1), 'story delete');
      const res = await api(`/api/stories/${id}`, 'DELETE');
      console.log(render(res, ctx.format));
      break;
    }
    case 'bulk-create': {
      const journeyId = req(f, 'journey', 'journeyId');
      const file = req(f, 'file');
      const items: unknown[] = JSON.parse((await import('node:fs')).readFileSync(file, 'utf-8'));
      const created: unknown[] = [];
      for (const it of items) {
        if (!isObj(it) || typeof it.title !== 'string') throw new Error(`bulk-create 文件条目需含 title: ${JSON.stringify(it)}`);
        const res = await api('/api/stories', 'POST', {
          journeyId,
          title: it.title,
          description: it.description ?? '',
          priority: it.priority ?? 'medium',
          estimation: it.estimation ?? 0,
          acceptanceCriteria: it.acceptance_criteria ?? it.acceptanceCriteria ?? [],
          tags: it.tags ?? [],
        });
        created.push(res);
      }
      console.log(render({ created: created.length, items: created }, ctx.format));
      break;
    }
    default: throw new Error(`未知子命令: story ${sub ?? ''}\n\n${helpText()}`);
  }
}

// ---------- task ----------
async function cmdTask(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0];
  const f = ctx.flags;
  switch (sub) {
    case 'list': {
      const storyId = opt(f, 'story', 'storyId');
      if (!storyId) throw new Error('用法: xcart task list --story <id>');
      const data = await api(`/api/tasks?storyId=${encodeURIComponent(storyId)}`);
      const rows = (Array.isArray(data) ? data : []).map((t) => ({
        id: t.id, title: t.title, type: t.type, priority: t.priority, status: t.status, estimation: t.estimation, assignee: t.assignee ?? '',
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'info': {
      const id = reqId(ctx.positional.slice(1), 'task info');
      const data = await api(`/api/tasks/${id}`);
      console.log(render(data, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'create': {
      const body: Record<string, unknown> = {
        storyId: req(f, 'story', 'storyId'),
        title: req(f, 'title'),
        description: opt(f, 'description') ?? '',
        type: opt(f, 'type') ?? 'technical_task',
        priority: opt(f, 'priority') ?? 'P2',
        estimation: Number(opt(f, 'estimation') ?? '0'),
      };
      const deps = splitList(opt(f, 'deps', 'dependencies')); if (deps) body.dependencies = deps;
      const tags = splitList(opt(f, 'tags')); if (tags) body.tags = tags;
      const data = await api('/api/tasks', 'POST', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'update': {
      const id = reqId(ctx.positional.slice(1), 'task update');
      const body: Record<string, unknown> = {};
      const title = opt(f, 'title'); if (title !== undefined) body.title = title;
      const desc = opt(f, 'description'); if (desc !== undefined) body.description = desc;
      const type = opt(f, 'type'); if (type !== undefined) body.type = type;
      const priority = opt(f, 'priority'); if (priority !== undefined) body.priority = priority;
      const est = opt(f, 'estimation'); if (est !== undefined) body.estimation = Number(est);
      const deps = opt(f, 'deps');
      if (deps !== undefined) body.dependencies = splitList(deps);
      const assignee = opt(f, 'assignee'); if (assignee !== undefined) body.assignee = assignee;
      const status = opt(f, 'status');
      if (status !== undefined) {
        const res = await api(`/api/tasks/${id}/status`, 'POST', { status, reason: opt(f, 'reason') });
        if (Object.keys(body).length === 0) { console.log(render(res, ctx.format)); return; }
      }
      const data = await api(`/api/tasks/${id}`, 'PATCH', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'status': {
      const id = reqId(ctx.positional.slice(1), 'task status <id> <status>');
      const status = ctx.positional[2];
      if (!status) throw new Error('用法: xcart task status <id> <status> [--reason]');
      const res = await api(`/api/tasks/${id}/status`, 'POST', { status, reason: opt(f, 'reason') });
      console.log(render(res, ctx.format));
      break;
    }
    case 'delete': {
      const id = reqId(ctx.positional.slice(1), 'task delete');
      const res = await api(`/api/tasks/${id}`, 'DELETE');
      console.log(render(res, ctx.format));
      break;
    }
    case 'next': {
      const projectId = req(f, 'project', 'projectId');
      const params = new URLSearchParams({ projectId });
      const assignee = opt(f, 'assignee');
      if (assignee !== undefined) params.set('assignee', assignee);
      const data = await api(`/api/tasks/next?${params}`);
      console.log(render(data, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'summary': {
      const projectId = req(f, 'project', 'projectId');
      const proj = await api(`/api/projects/${projectId}`);
      const journeys: unknown[] = Array.isArray(proj.user_journeys) ? proj.user_journeys : [];
      let tasks: any[] = [];
      for (const j of journeys) {
        const stories = await api(`/api/stories?journeyId=${encodeURIComponent((j as any).id)}`).catch(() => []);
        for (const s of Array.isArray(stories) ? stories : []) {
          const ts = await api(`/api/tasks?storyId=${encodeURIComponent((s as any).id)}`).catch(() => []);
          if (Array.isArray(ts)) tasks = tasks.concat(ts);
        }
      }
      const count = (s: string) => tasks.filter((t) => t.status === s).length;
      const summary = {
        project_id: projectId,
        total: tasks.length,
        by_status: {
          backlog: count('backlog'), todo: count('todo'), in_progress: count('in_progress'),
          in_review: count('in_review'), testing: count('testing'), done: count('done'), cancelled: count('cancelled'),
        },
        done_ratio: tasks.length ? Math.round((count('done') / tasks.length) * 100) : 0,
      };
      console.log(render(summary, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'bulk-create': {
      const storyId = req(f, 'story', 'storyId');
      const file = req(f, 'file');
      const items: unknown[] = JSON.parse((await import('node:fs')).readFileSync(file, 'utf-8'));
      const created: unknown[] = [];
      for (const it of items) {
        if (!isObj(it) || typeof it.title !== 'string') throw new Error(`bulk-create 文件条目需含 title: ${JSON.stringify(it)}`);
        const res = await api('/api/tasks', 'POST', {
          storyId,
          title: it.title,
          description: it.description ?? '',
          type: it.type ?? 'technical_task',
          priority: it.priority ?? 'P2',
          estimation: Number(it.estimation ?? 0),
          dependencies: it.dependencies ?? [],
          tags: it.tags ?? [],
        });
        created.push(res);
      }
      console.log(render({ created: created.length, items: created }, ctx.format));
      break;
    }
    default: throw new Error(`未知子命令: task ${sub ?? ''}\n\n${helpText()}`);
  }
}

// ---------- milestone ----------
async function cmdMilestone(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0];
  const f = ctx.flags;
  switch (sub) {
    case 'list': {
      const projectId = req(f, 'project', 'projectId');
      const data = await api(`/api/milestones?projectId=${encodeURIComponent(projectId)}`);
      const rows = (Array.isArray(data) ? data : []).map((m) => ({
        id: m.id, name: m.name, status: m.status, goal: m.goal ?? '', target_date: m.target_date ?? '',
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'create': {
      const body: Record<string, unknown> = {
        project_id: req(f, 'project', 'projectId'),
        name: req(f, 'name'),
      };
      const goal = opt(f, 'goal'); if (goal !== undefined) body.goal = goal;
      const date = opt(f, 'date', 'target-date'); if (date !== undefined) body.target_date = date;
      const status = opt(f, 'status'); if (status !== undefined) body.status = status;
      const data = await api('/api/milestones', 'POST', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'update': {
      const id = reqId(ctx.positional.slice(1), 'milestone update');
      const body: Record<string, unknown> = {};
      const name = opt(f, 'name'); if (name !== undefined) body.name = name;
      const goal = opt(f, 'goal'); if (goal !== undefined) body.goal = goal;
      const date = opt(f, 'date', 'target-date'); if (date !== undefined) body.target_date = date === 'none' ? null : date;
      const status = opt(f, 'status'); if (status !== undefined) body.status = status;
      const data = await api(`/api/milestones/${id}`, 'PATCH', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'delete': {
      const id = reqId(ctx.positional.slice(1), 'milestone delete');
      const res = await api(`/api/milestones/${id}`, 'DELETE');
      console.log(render(res, ctx.format));
      break;
    }
    default: throw new Error(`未知子命令: milestone ${sub ?? ''}\n\n${helpText()}`);
  }
}

// ---------- status ----------
async function cmdStatus(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0] ?? 'all';
  switch (sub) {
    case 'history': {
      const entityId = opt(ctx.flags, 'entity', 'entityId') ?? ctx.positional[1];
      if (!entityId) throw new Error('用法: xcart status history <entityId>');
      const data = await api(`/api/status-changes?entityId=${encodeURIComponent(entityId)}`);
      console.log(render(data, ctx.format));
      break;
    }
    case 'all': {
      const data = await api('/api/status-changes');
      console.log(render(data, ctx.format));
      break;
    }
    default: throw new Error(`未知子命令: status ${sub ?? ''}\n\n${helpText()}`);
  }
}

// ---------- context / overview ----------
// 树直读：project API 返回的 user_journeys[].stories[].tasks 已含全字段，
// 不再逐 story 发起 N+1 请求（原实现对 41 故事的项目 = 42 次 HTTP）。

type TreeJourney = {
  id?: string; name?: string; persona?: string;
  stories?: Array<{ id?: string; title?: string; description?: string; status?: string;
    priority?: string; estimation?: number; tasks?: Array<{ status?: string }> }>;
};

/** 从项目树汇总统计（journeys/stories/tasks 计数与状态分布） */
function summarizeTree(proj: Record<string, unknown>): {
  journeys: TreeJourney[];
  storyCount: number; doneStories: number;
  taskCount: number; doneTasks: number;
  taskStatus: Record<string, number>;
  storyStatus: Record<string, number>;
} {
  const journeys: TreeJourney[] = (Array.isArray(proj.user_journeys) ? proj.user_journeys : []) as TreeJourney[];
  let storyCount = 0, doneStories = 0, taskCount = 0, doneTasks = 0;
  const taskStatus: Record<string, number> = {};
  const storyStatus: Record<string, number> = {};
  for (const j of journeys) {
    const stories = Array.isArray(j.stories) ? j.stories : [];
    for (const s of stories) {
      storyCount++;
      const ss = s.status ?? 'backlog';
      storyStatus[ss] = (storyStatus[ss] ?? 0) + 1;
      if (ss === 'done') doneStories++;
      for (const t of Array.isArray(s.tasks) ? s.tasks : []) {
        taskCount++;
        const ts = t.status ?? 'backlog';
        taskStatus[ts] = (taskStatus[ts] ?? 0) + 1;
        if (ts === 'done') doneTasks++;
      }
    }
  }
  return { journeys, storyCount, doneStories, taskCount, doneTasks, taskStatus, storyStatus };
}

async function cmdContextExport(projectId: string, fmt: Format): Promise<void> {
  const proj = await api(`/api/projects/${projectId}`);
  if (!isObj(proj) || !proj.id) throw new Error(`项目不存在: ${projectId}`);
  const milestones = await api(`/api/milestones?projectId=${encodeURIComponent(projectId)}`).catch(() => []);
  const { journeys, storyCount, taskCount, doneTasks } = summarizeTree(proj);
  const journeyBlocks: string[] = [];
  for (const j of journeys) {
    const stories = Array.isArray(j.stories) ? j.stories : [];
    const storyBlocks = stories.map((s) =>
      `- [${s.status ?? 'backlog'}] **${s.title}** (${s.id}, priority=${s.priority}, ${s.estimation}h)`
      + (Array.isArray(s.tasks) && s.tasks.length ? ` — ${s.tasks.length} 任务` : '')
      + `\n  ${(s.description ?? '').split('\n')[0] || ''}`);
    journeyBlocks.push(`### 旅程 ${j.name} (${j.id}) — 角色: ${j.persona}\n${storyBlocks.join('\n')}`);
  }
  const md = `# ${proj.name} — 全景上下文\n
> 项目: ${proj.id} | 描述: ${proj.description ?? '-'}\n
## 统计\n
- 旅程: ${journeys.length} | 故事: ${storyCount} | 任务: ${taskCount}（完成 ${doneTasks}）\n
- 版本: ${(Array.isArray(milestones) ? milestones : []).map((m) => `${m.name}(${m.status})`).join(', ') || '-'}\n
## 用户旅程与故事\n
${journeyBlocks.join('\n\n')}\n`;
  if (fmt === 'markdown') console.log(md);
  else if (fmt === 'json') console.log(JSON.stringify({ project: { id: proj.id, name: proj.name, description: proj.description }, milestones, journeys }, null, 2));
  else console.log(JSON.stringify(md, null, 2));
}

async function cmdOverview(ctx: Ctx): Promise<void> {
  const projectId = req(ctx.flags, 'project', 'projectId');
  const proj = await api(`/api/projects/${projectId}`);
  if (!isObj(proj) || !proj.id) throw new Error(`项目不存在: ${projectId}`);
  const { journeys, storyCount, doneStories, taskCount, doneTasks, taskStatus, storyStatus } = summarizeTree(proj);
  if (ctx.format === 'json') {
    console.log(JSON.stringify({
      project_id: proj.id, name: proj.name,
      journeys: journeys.length, stories: storyCount, done_stories: doneStories,
      tasks: taskCount, done_tasks: doneTasks,
      task_status: taskStatus, story_status: storyStatus,
    }, null, 2));
    return;
  }
  const md = `# ${proj.name} — 项目总览\n
- 旅程: ${journeys.length}\n- 故事: ${storyCount}（完成 ${doneStories}）\n- 任务: ${taskCount}（完成 ${doneTasks}）\n- 任务状态: ${JSON.stringify(taskStatus)}\n- 故事状态: ${JSON.stringify(storyStatus)}\n`;
  console.log(md);
}


// ---------- skill ----------
async function cmdSkill(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0] ?? 'list';
  const repoRoot = new URL('../../..', import.meta.url).pathname; // apps/cli/src -> repo root
  const skillsDir = `${repoRoot}skills`;
  const f = ctx.flags;
  switch (sub) {
    case 'list': {
      const { readdirSync, existsSync } = await import('node:fs');
      if (!existsSync(skillsDir)) { console.log('skills 目录不存在（尚未创建）: ' + skillsDir); break; }
      const dirs = readdirSync(skillsDir).filter((d) => !d.startsWith('.'));
      const rows = dirs.map((d) => ({ skill: d, path: `${skillsDir}/${d}/SKILL.md` }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'install': {
      const { cpSync, existsSync, mkdirSync } = await import('node:fs');
      const explicit = opt(f, 'dir');
      const targets = explicit
        ? [explicit]
        : [`${repoRoot}.claude/skills`];
      if (!existsSync(skillsDir)) throw new Error(`skills 目录不存在: ${skillsDir}`);
      const dirs = (await import('node:fs')).readdirSync(skillsDir).filter((d) => !d.startsWith('.'));
      const installed: string[] = [];
      for (const t of targets) {
        for (const d of dirs) {
          const dest = `${t}/${d}`;
          mkdirSync(dest, { recursive: true });
          cpSync(`${skillsDir}/${d}`, dest, { recursive: true });
        }
        installed.push(t);
      }
      console.log(render({ installed_to: installed, skills: dirs }, ctx.format));
      break;
    }
    default: throw new Error(`未知子命令: skill ${sub ?? ''}\n\n${helpText()}`);
  }
}

// ─── 旧命令别名（向后兼容）──────────────────────────────────
const LEGACY: Record<string, string[]> = {
  projects: ['project', 'list'],
  milestones: ['milestone', 'list'],
};
async function cmdLegacy(ctx: Ctx, where: string): Promise<void> {
  switch (where) {
    case 'projects': return cmdProject({ ...ctx, positional: ['list'] });
    case 'milestones': {
      const id = ctx.positional[0];
      if (!id) throw new Error('用法: xcart milestones <projectId>');
      return cmdMilestone({ ...ctx, positional: ['list'], flags: new Map([...ctx.flags, ['project', id]]) });
    }
  }
}

// ─── 入口 ─────────────────────────────────────────────────────
function helpText(): string {
  return `xcart — X-Cartographer CLI (v${VERSION})

用法: xcart <command> [subcommand] [options]

项目管理
  xcart project list
  xcart project info --id <id>
  xcart project create --name <name> [--description] [--tech-stack a,b]
  xcart project update <id> [--name] [--description]
  xcart project delete <id>

用户旅程
  xcart journey list --project <id>
  xcart journey info <id>                        # 该旅程下的故事
  xcart journey create --project <id> --name <n> [--persona] [--description]
  xcart journey update <id> [--name] [--persona] [--description] [--order]
  xcart journey delete <id>

用户故事
  xcart story list --journey <id>
  xcart story info <id>
  xcart story create --journey <id> --title <t> [--priority] [--estimation] [--ac "a;b"] [--tags a,b]
  xcart story update <id> [--title] [--priority] [--status] [--milestone <id>|none] [--estimation]
  xcart story status <id> <status> [--reason]
  xcart story delete <id>
  xcart story bulk-create --journey <id> --file stories.json

任务
  xcart task list --story <id>
  xcart task info <id>
  xcart task create --story <id> --title <t> [--type] [--priority] [--estimation] [--deps a,b] [--tags a,b]
  xcart task update <id> [--title] [--status] [--assignee] [--priority] [--type] [--estimation]
  xcart task status <id> <status> [--reason]
  xcart task delete <id>
  xcart task next --project <id> [--assignee]   # 下一个可执行任务（拓扑规则）
  xcart task summary --project <id>             # 任务统计
  xcart task bulk-create --story <id> --file tasks.json

版本 / 里程碑
  xcart milestone list --project <id>
  xcart milestone create --project <id> --name <n> [--goal] [--date] [--status]
  xcart milestone update <id> [--name] [--goal] [--date] [--status]
  xcart milestone delete <id>

状态历史
  xcart status history <entityId>
  xcart status all

上下文 / 总览
  xcart context export <projectId>              # 项目全景 Markdown（供 LLM）
  xcart overview --project <id>                 # 项目总览统计

Skills
  xcart skill list
  xcart skill install [--dir <target>]          # 安装 skills/*.SKILL.md 到 agent 目录

  --server, -s <url>   gateway 地址（优先级: flag > 配置文件 ~/.config/xcart/config > $XCART_API_URL > http://localhost:8787）
  --token,  -t <token> API Token（优先级: flag > 配置文件 > $XCART_API_TOKEN）
  --format, -f <fmt>   table | json | markdown（默认 table）
  --help, -h / --version, -v

配置文件
  路径: ~/.config/xcart/config（或 $XDG_CONFIG_HOME/xcart/config）
  格式: key=value 每行一个（server=..., token=...），# 注释
`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--version') || args.includes('-v')) {
    console.log(`xcart ${VERSION}`);
    return;
  }
  const { flags, boolFlags, positional } = parseArgs(args);
  if (boolFlags.has('help') || args.includes('--help') || args.includes('-h')) {
    console.log(helpText());
    return;
  }
  if (flags.has('server')) server = flags.get('server')!;
  if (flags.has('token')) token = flags.get('token')!;
  const fmt: Format = (flags.get('format') ?? flags.get('f')) as Format;
  const format: Format = ['json', 'markdown'].includes(fmt) ? fmt : 'table';

  const cmd = positional[0];
  const rest = positional.slice(1);
  const ctx: Ctx = { flags, format, positional: rest };

  try {
    switch (cmd) {
      case 'project': await cmdProject(ctx); break;
      case 'journey': await cmdJourney(ctx); break;
      case 'story': await cmdStory(ctx); break;
      case 'task': await cmdTask(ctx); break;
      case 'milestone': await cmdMilestone(ctx); break;
      case 'status': await cmdStatus(ctx); break;
      case 'overview': await cmdOverview(ctx); break;
      case 'context': {
        const sub = rest[0];
        if (sub === 'export') {
          const id = rest[1] ?? flags.get('project') ?? flags.get('projectId');
          if (!id) throw new Error('用法: xcart context export <projectId>');
          await cmdContextExport(id, flags.has('format') ? format : 'markdown');
        } else throw new Error(`未知子命令: context ${sub ?? ''}`);
        break;
      }
      case 'export-context': { // 兼容旧命名
        const id = rest[0] ?? flags.get('project');
        if (!id) throw new Error('用法: xcart export-context <projectId>');
        await cmdContextExport(id, 'markdown');
        break;
      }
      case 'skill': await cmdSkill(ctx); break;
      // 旧扁平命令兼容
      case 'projects': await cmdLegacy(ctx, 'projects'); break;
      case 'milestones': await cmdLegacy(ctx, 'milestones'); break;
      case 'create-milestone': {
        const projectId = rest[0], name = rest[1];
        if (!projectId || !name) throw new Error('用法: xcart create-milestone <projectId> <name> [--goal] [--date]');
        await cmdMilestone({ ...ctx, positional: ['create'], flags: new Map([...ctx.flags, ['project', projectId], ['name', name]]) });
        break;
      }
      case 'story-status': {
        const [id, status] = rest;
        if (!id || !status) throw new Error('用法: xcart story-status <storyId> <status> [--reason]');
        await cmdStory({ ...ctx, positional: ['status', id, status] });
        break;
      }
      case 'task-status': {
        const [id, status] = rest;
        if (!id || !status) throw new Error('用法: xcart task-status <taskId> <status> [--reason]');
        await cmdTask({ ...ctx, positional: ['status', id, status] });
        break;
      }
      case 'project': break;
      case undefined:
      case 'help': console.log(helpText()); break;
      default: throw new Error(`未知命令: ${cmd}\n\n${helpText()}`);
    }
  } catch (err) {
    console.error(`错误: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

main();
