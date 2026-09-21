#!/usr/bin/env bun
/**
 * @x-cartographer/cli — X-Cartographer 命令行接口 (xcart)
 *
 * 面向 coding agent / 脚本 / 终端用户。通过 HTTP 调用 gateway REST API 操作
 * 用户故事地图与任务管理数据。
 *
 * 用法（嵌套子命令 + GNU flag 风格）:
 *   xcart product list | info | create | update | delete       (project 为 deprecated alias)
 *   xcart activity list | info | create | update | delete      (journey 为 deprecated alias)
 *   xcart story  list | info | create | update | status | delete | bulk-create
 *   xcart dev-task list | info | create | update | status | delete | next | summary | bulk-create  (task 为 deprecated alias)
 *   xcart milestone list | create | update | delete
 *   xcart adr create | list | show | status | current | as-of-milestone
 *   xcart status history <entityId> | all | ratify <type> <id> --reason
 *   xcart context export <projectId>      (兼容别名: xcart export-context <id>)
 *   xcart overview --project <id>
 *   xcart trace <story|module|adr> <id>   (约束→模块→实现 追溯链)
 *   xcart ctx <taskId>                    (任务上下文切片)
 *   xcart skill install | list
 *
 * 全局选项（放在任意位置均可）:
 *   --server, -s <url>      gateway 地址（默认 $XCART_API_URL 或 http://localhost:8787）
 *   --token,  -t <token>    API Token（默认 $XCART_API_TOKEN；gateway 启用认证时需要）
 *   --format, -f <fmt>      输出格式: table | json | markdown（默认 table；overview/context 恒为 markdown）
 *   --help, -h              帮助
 *   --version, -v           版本
 */

const VERSION = '0.2.1';
const DEFAULT_SERVER = 'http://localhost:8787';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  resolveEffectiveArchitectureContext,
  type EffectiveArchitectureContext,
} from '@x-cartographer/shared';

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

// ─── 有效架构上下文（technical-constitution.md §4/§6）────────────────
/** 由 activity 反查产品（story 详情只有 activity_id，宪法按产品取） */
async function productIdOfActivity(activityId: string): Promise<string | null> {
  const activity = await api(`/api/user-activities/${encodeURIComponent(activityId)}`).catch(() => null);
  return isObj(activity) && typeof activity.product_id === 'string' ? activity.product_id : null;
}

/**
 * 取宪法并做范围过滤（§4），供 story info / task info 展示。
 *
 * 历史态 vs 当前态（§3.3/§4）：**只有该里程碑被 ADR 锚定时**才用 as-of-milestone 历史态——
 * §4 伪代码写的是「story.milestone_id 有 adr_id」，方向是 ADR 引用里程碑（§5：
 * `xcart adr create --milestone` 手动关联，不自动快照）。故判据是「存在 milestone_id 指向
 * 该版本的 ADR」，而不是「故事挂了版本」——后者会把所有挂版本的故事都拽回历史态，
 * 结果永远看不到当前生效的宪法。
 *
 * 产品未知或宪法不可得时返回 null——不伪造空对象（"没有宪法"是事实，该显式缺席）。
 */
async function fetchArchitectureContext(
  productId: string | null,
  moduleScope: string[] | null | undefined,
  milestoneId?: string | null
): Promise<{ architecture_context: EffectiveArchitectureContext | null }> {
  if (!productId) return { architecture_context: null };

  let constitution: unknown = null;
  if (milestoneId) {
    const adrs = await api(`/api/adr-records?productId=${encodeURIComponent(productId)}`).catch(() => null);
    const anchored = Array.isArray(adrs) && adrs.some((a) => a?.milestone_id === milestoneId);
    if (anchored) {
      constitution = await api(
        `/api/adr-records/as-of-milestone?milestoneId=${encodeURIComponent(milestoneId)}`
      ).catch(() => null);
    }
  }
  if (!isObj(constitution)) {
    constitution = await api(
      `/api/adr-records/current?productId=${encodeURIComponent(productId)}`
    ).catch(() => null);
  }
  if (!isObj(constitution)) return { architecture_context: null };

  return { architecture_context: resolveEffectiveArchitectureContext(constitution, moduleScope) };
}

// ─── 命令实现 ─────────────────────────────────────────────────
type Ctx = { flags: Map<string, string>; format: Format; positional: string[] };

// ---------- project ----------
async function cmdProduct(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0];
  const f = ctx.flags;
  switch (sub) {
    case 'list': {
      const data = await api('/api/products');
      const trim = (s: unknown, n: number) =>
        typeof s === 'string' && s.length > n ? s.slice(0, n) + '…' : (typeof s === 'string' ? s : '');
      const rows = (Array.isArray(data) ? data : []).map((p) => ({
        id: (p && typeof p === 'object' && 'id' in p && typeof p.id === 'string') ? p.id : '?',
        name: trim(p && typeof p === 'object' && 'name' in p ? p.name : '', 40),
        description: trim(p && typeof p === 'object' && 'description' in p ? p.description : '', 60),
        activities: p && typeof p === 'object' && 'user_activities' in p && Array.isArray(p.user_activities) ? p.user_activities.length : 0,
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'info': {
      const id = opt(f, 'id', 'project') ?? ctx.positional[1];
      if (!id) throw new Error('用法: xcart project info --id <id>');
      const data = await api(`/api/products/${id}`);
      console.log(render(data, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'create': {
      const body: Record<string, unknown> = { name: req(f, 'name') };
      const desc = opt(f, 'description'); if (desc !== undefined) body.description = desc;
      const tech = splitList(opt(f, 'tech-stack', 'techStack')); if (tech) body.tech_stack = tech;
      const wd = opt(f, 'workspace-dir', 'workspaceDir'); if (wd !== undefined) body.workspace_dir = wd;
      const prov = opt(f, 'provenance'); if (prov) body.provenance = prov;
      const data = await api('/api/products', 'POST', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'update': {
      const id = reqId(ctx.positional.slice(1), 'project update');
      const body: Record<string, unknown> = {};
      const name = opt(f, 'name'); if (name !== undefined) body.name = name;
      const desc = opt(f, 'description'); if (desc !== undefined) body.description = desc;
      const data = await api(`/api/products/${id}`, 'PATCH', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'delete': {
      const id = reqId(ctx.positional.slice(1), 'project delete');
      const res = await api(`/api/products/${id}`, 'DELETE');
      console.log(render(res, ctx.format));
      break;
    }
    default: throw new Error(`未知子命令: project ${sub ?? ''}\n\n${helpText()}`);
  }
}

// ---------- activity（用户活动 / backbone）----------
async function cmdUserActivity(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0];
  const f = ctx.flags;
  switch (sub) {
    case 'list': {
      const productId = req(f, 'product', 'project');
      const data = await api(`/api/user-activities?productId=${encodeURIComponent(productId)}`);
      const rows = (Array.isArray(data) ? data : []).map((j) => ({
        id: j.id, name: j.name, description: j.description ?? '', stories: j.stories?.length ?? 0,
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'info': {
      const id = reqId(ctx.positional.slice(1), 'activity info');
      const data = await api(`/api/stories?activityId=${encodeURIComponent(id)}`);
      console.log(render({ activity_id: id, stories: Array.isArray(data) ? data : [] }, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'create': {
      const body: Record<string, unknown> = {
        productId: req(f, 'product', 'project'),
        name: req(f, 'name'),
        description: opt(f, 'description') ?? '',
      };
      const prov = opt(f, 'provenance'); if (prov) body.provenance = prov;
      const data = await api('/api/user-activities', 'POST', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'update': {
      const id = reqId(ctx.positional.slice(1), 'activity update');
      const body: Record<string, unknown> = {};
      const name = opt(f, 'name'); if (name !== undefined) body.name = name;
      const desc = opt(f, 'description'); if (desc !== undefined) body.description = desc;
      const order = opt(f, 'order'); if (order !== undefined) body.order = Number(order);
      const data = await api(`/api/user-activities/${id}`, 'PATCH', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'delete': {
      const id = reqId(ctx.positional.slice(1), 'activity delete');
      const res = await api(`/api/user-activities/${id}`, 'DELETE');
      console.log(render(res, ctx.format));
      break;
    }
    default: throw new Error(`未知子命令: activity ${sub ?? ''}\n\n${helpText()}`);
  }
}

// ---------- user-task（用户任务：活动下的操作步骤，故事地图第二层）----------
async function cmdUserTask(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0];
  const f = ctx.flags;
  switch (sub) {
    case 'list': {
      const activityId = opt(f, 'activity');
      const productId = opt(f, 'product', 'project');
      if (!activityId && !productId) throw new Error('用法: xcart user-task list --activity <id> | --product <id>');
      const qs = activityId ? `activityId=${encodeURIComponent(activityId)}` : `productId=${encodeURIComponent(productId!)}`;
      const data = await api(`/api/user-tasks?${qs}`);
      const rows = (Array.isArray(data) ? data : []).map((t) => ({
        id: t.id, activity: t.activity_id, name: t.name, order: t.order,
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'create': {
      const body: Record<string, unknown> = {
        activityId: req(f, 'activity'),
        name: req(f, 'name'),
        description: opt(f, 'description') ?? '',
      };
      const order = opt(f, 'order'); if (order !== undefined) Object.assign(body, { order: Number(order) });
      const prov = opt(f, 'provenance'); if (prov) body.provenance = prov;
      const data = await api('/api/user-tasks', 'POST', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'update': {
      const id = reqId(ctx.positional.slice(1), 'user-task update');
      const body: Record<string, unknown> = {};
      const name = opt(f, 'name'); if (name !== undefined) body.name = name;
      const desc = opt(f, 'description'); if (desc !== undefined) body.description = desc;
      const order = opt(f, 'order'); if (order !== undefined) body.order = Number(order);
      const data = await api(`/api/user-tasks/${id}`, 'PATCH', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'delete': {
      const id = reqId(ctx.positional.slice(1), 'user-task delete');
      const res = await api(`/api/user-tasks/${id}`, 'DELETE');
      console.log(render(res, ctx.format));
      break;
    }
    default: throw new Error(`未知子命令: user-task ${sub ?? ''}\n\n${helpText()}`);
  }
}

// ---------- story ----------
async function cmdStory(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0];
  const f = ctx.flags;
  switch (sub) {
    case 'list': {
      const activityId = opt(f, 'activity', 'journey');
      if (!activityId) throw new Error('用法: xcart story list --activity <id>');
      const data = await api(`/api/stories?activityId=${encodeURIComponent(activityId)}`);
      const rows = (Array.isArray(data) ? data : []).map((s) => ({
        id: s.id, title: s.title, priority: s.priority, status: s.status ?? '', estimation: s.estimation, milestone: s.milestone_id ?? '',
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'info': {
      const id = reqId(ctx.positional.slice(1), 'story info');
      const data = await api(`/api/stories/${id}`);
      const tasks = await api(`/api/dev-tasks?storyId=${encodeURIComponent(id)}`).catch(() => []);
      const architecture = await fetchArchitectureContext(
        data.activity_id ? await productIdOfActivity(data.activity_id) : null,
        data.affected_modules
      );
      const out = { ...data, tasks: Array.isArray(tasks) ? tasks : [], ...architecture };
      console.log(render(out, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'create': {
      const body: Record<string, unknown> = {
        activityId: req(f, 'activity', 'journey'),
        title: req(f, 'title'),
      };
      const desc = opt(f, 'description'); if (desc !== undefined) body.description = desc;
      body.priority = opt(f, 'priority') ?? 'medium';
      const est = opt(f, 'estimation'); if (est !== undefined) body.estimation = Number(est);
      const ac = splitList(opt(f, 'ac', 'acceptance')); if (ac) body.acceptanceCriteria = ac;
      const tags = splitList(opt(f, 'tags')); if (tags) body.tags = tags;
      const prov = opt(f, 'provenance'); if (prov) body.provenance = prov;
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
      const affected = splitList(opt(f, 'affected-modules', 'modules')); if (affected) body.affectedModules = affected;
      const activity = opt(f, 'journey');
      if (activity !== undefined) body.activityId = activity === 'none' ? null : activity;
      const milestone = opt(f, 'milestone');
      if (milestone !== undefined) body.milestoneId = milestone === 'none' ? null : milestone;
      const userTask = opt(f, 'user-task');
      if (userTask !== undefined) body.userTaskId = userTask === 'none' ? null : userTask;
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
      if (status === 'cancelled' && !opt(f, 'reason')) {
        throw new Error('取消（cancelled）必须提供 --reason（记录放弃依据）');
      }
      const res = await api(`/api/stories/${id}/status`, 'POST', { status, reason: opt(f, 'reason') });
      console.log(render(res, ctx.format));
      break;
    }
    case 'move': {
      const id = reqId(ctx.positional.slice(1), 'story move');
      const activityId = ctx.positional[2];
      if (!activityId) throw new Error('用法: xcart story move <storyId> <activityId>');
      const res = await api(`/api/stories/${id}`, 'PATCH', { activityId });
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
      const activityId = req(f, 'activity', 'journey');
      const file = req(f, 'file');
      const items: unknown[] = JSON.parse((await import('node:fs')).readFileSync(file, 'utf-8'));
      const created: unknown[] = [];
      for (const it of items) {
        if (!isObj(it) || typeof it.title !== 'string') throw new Error(`bulk-create 文件条目需含 title: ${JSON.stringify(it)}`);
        const res = await api('/api/stories', 'POST', {
          activityId,
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
async function cmdDevTask(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0];
  const f = ctx.flags;
  switch (sub) {
    case 'list': {
      // 三种检索路径：--story（故事锚定）/ --module-id（模块锚定，§2.5）/ --product（全部）
      const storyId = opt(f, 'story', 'storyId');
      const productId = opt(f, 'product', 'project');
      const moduleId = opt(f, 'module-id', 'moduleId');
      if (!storyId && !productId && !moduleId) {
        throw new Error('用法: xcart dev-task list --story <id> | --product <id> | --module-id <slug>');
      }
      const params = new URLSearchParams();
      if (productId) params.set('productId', productId);
      if (moduleId) params.set('moduleId', moduleId);
      const data = productId || moduleId
        ? await api(`/api/dev-tasks/all?${params}`)
        : await api(`/api/dev-tasks?storyId=${encodeURIComponent(storyId!)}`);
      const rows = (Array.isArray(data) ? data : []).map((t) => ({
        id: t.id, title: t.title, priority: t.priority, status: t.status,
        estimation: t.estimation, assignee: t.assignee ?? '',
        anchor: t.story_id ? `story:${t.story_id}` : (t.module_id ? `module:${t.module_id}` : '-'),
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'info': {
      const id = reqId(ctx.positional.slice(1), 'task info');
      const data = await api(`/api/dev-tasks/${id}`);
      // §4：scope 优先取任务自身 affected_modules，缺失时回落到所属故事（task 可只挂 module_id）
      let scope = Array.isArray(data.affected_modules) && data.affected_modules.length
        ? data.affected_modules
        : null;
      let milestoneId: string | null = null;
      let productId: string | null = data.product_id ?? null;
      if (data.story_id) {
        const story = await api(`/api/stories/${encodeURIComponent(data.story_id)}`).catch(() => null);
        if (isObj(story)) {
          if (!scope && Array.isArray(story.affected_modules) && story.affected_modules.length) {
            scope = story.affected_modules;
          }
          milestoneId = story.milestone_id ?? null;
          if (!productId && story.activity_id) productId = await productIdOfActivity(story.activity_id);
        }
      }
      if (!scope && data.module_id) scope = [data.module_id];
      const architecture = await fetchArchitectureContext(productId, scope, milestoneId);
      const out = { ...data, ...architecture };
      console.log(render(out, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'create': {
      // 两种锚定（domain-model §2.5）：① --story（有用户价值的工作项）
      // ② --product + --module-id（工程治理类：重构/技术债，不编入故事地图）
      const story = opt(f, 'story', 'storyId');
      const product = opt(f, 'product', 'project');
      const moduleId = opt(f, 'module-id', 'moduleId');
      if (!story && !(product && moduleId)) {
        throw new Error(
          '用法: xcart task create --story <storyId> … ' +
          '| --product <productId> --module-id <slug> …（工程治理类任务，story_id 为空）'
        );
      }
      const body: Record<string, unknown> = {
        title: req(f, 'title'),
        description: opt(f, 'description') ?? '',
        priority: opt(f, 'priority') ?? 'P2',
        estimation: Number(opt(f, 'estimation') ?? '0'),
      };
      if (story) body.storyId = story;
      if (product) body.productId = product;
      if (moduleId) body.moduleId = moduleId;
      const deps = splitList(opt(f, 'deps', 'dependencies')); if (deps) body.dependencies = deps;
      const tags = splitList(opt(f, 'tags')); if (tags) body.tags = tags;
      const data = await api('/api/dev-tasks', 'POST', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'update': {
      const id = reqId(ctx.positional.slice(1), 'task update');
      const body: Record<string, unknown> = {};
      const title = opt(f, 'title'); if (title !== undefined) body.title = title;
      const desc = opt(f, 'description'); if (desc !== undefined) body.description = desc;
      const priority = opt(f, 'priority'); if (priority !== undefined) body.priority = priority;
      const est = opt(f, 'estimation'); if (est !== undefined) body.estimation = Number(est);
      const deps = opt(f, 'deps');
      if (deps !== undefined) body.dependencies = splitList(deps);
      const affected = splitList(opt(f, 'affected-modules', 'modules')); if (affected) body.affectedModules = affected;
      // 模块主锚（工程治理类）：与 affected_modules 不同——那是影响面标注，这是唯一主锚
      const moduleId = opt(f, 'module-id', 'moduleId'); if (moduleId !== undefined) body.moduleId = moduleId;
      const productId = opt(f, 'product', 'project'); if (productId !== undefined) body.productId = productId;
      const storyId = opt(f, 'story'); if (storyId !== undefined) body.storyId = storyId === 'none' ? null : storyId;
      // 解挂 story 后产品归属只剩 product_id：若它为空，任务会从**所有**产品视图
      // （next / summary / overview / /all?productId=）消失——静默变孤儿。
      // 与 create 的两种锚定要求对齐：要么挂 story，要么给出 product（工程治理类再带 module）。
      if (storyId === 'none' && productId === undefined) {
        const current = await api(`/api/dev-tasks/${id}`).catch(() => null);
        if (isObj(current) && !current.product_id) {
          throw new Error(
            `解挂 story 会让 ${id} 失去产品归属（product_id 为空），它将从所有产品视图中消失。` +
            `请同时给出 --product <productId>（工程治理类建议再带 --module-id <slug>）。`
          );
        }
      }
      const assignee = opt(f, 'assignee'); if (assignee !== undefined) body.assignee = assignee;
      const status = opt(f, 'status');
      if (status !== undefined) {
        const statusBody: Record<string, unknown> = { status, reason: opt(f, 'reason') };
        const expected = opt(f, 'expected-status');
        if (expected !== undefined) statusBody.expected_status = expected;
        const res = await api(`/api/dev-tasks/${id}/status`, 'POST', statusBody);
        if (Object.keys(body).length === 0) { console.log(render(res, ctx.format)); return; }
      }
      const data = await api(`/api/dev-tasks/${id}`, 'PATCH', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'status': {
      const id = reqId(ctx.positional.slice(1), 'task status <id> <status>');
      const status = ctx.positional[2];
      if (!status) throw new Error('用法: xcart task status <id> <status> [--expected-status <s>] [--reason]');
      if (status === 'cancelled' && !opt(f, 'reason')) {
        throw new Error('取消（cancelled）必须提供 --reason（记录放弃依据）');
      }
      const body: Record<string, unknown> = { status, reason: opt(f, 'reason') };
      const expected = opt(f, 'expected-status');
      if (expected !== undefined) body.expected_status = expected;
      try {
        const res = await api(`/api/dev-tasks/${id}/status`, 'POST', body);
        console.log(render(res, ctx.format));
      } catch (e) {
        if (e instanceof Error && e.message.includes('409')) {
          throw new Error(
            `状态冲突（409）：任务已被并发修改，expected_status=${expected} 不匹配当前状态。` +
            `请重新 task info ${id} 读取当前状态后再试；Agent 勿盲目重试（会掩盖并发认领）。`
          );
        }
        throw e;
      }
      break;
    }
    case 'delete': {
      const id = reqId(ctx.positional.slice(1), 'task delete');
      await api(`/api/dev-tasks/${id}`, 'DELETE');
      console.log(render({ success: true, id }, ctx.format));
      break;
    }
    case 'next': {
      const productId = req(f, 'product', 'project');
      const params = new URLSearchParams({ productId });
      const assignee = opt(f, 'assignee');
      if (assignee !== undefined) params.set('assignee', assignee);
      const data = await api(`/api/dev-tasks/next?${params}`);
      console.log(render(data, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'summary': {
      const productId = req(f, 'product', 'project');
      // 任务计数以 `/all`（repo 全量）为权威：深树看不到模块锚定任务
      // （story_id=null，domain-model §2.5），曾致统计系统性偏低。
      // 故事计数仍走深树（故事必然挂在活动下，深树完备）。
      const proj = await api(`/api/products/${productId}`);
      const all = await api(`/api/dev-tasks/all?productId=${encodeURIComponent(productId)}`);
      const tasks: Array<Record<string, unknown>> = Array.isArray(all) ? all : [];
      const { storyCount, doneStories, storyStatus, taskStatus } =
        summarizeTree(proj as Record<string, unknown>, tasks);
      // 其中不挂 story 的（工程治理类）单列——故事地图看不到它们，混在一起会让人以为漏了数据
      const moduleAnchored = tasks.filter((t) => t.story_id === null).length;
      const summary = {
        product_id: productId,
        stories: storyCount,
        done_stories: doneStories,
        story_status: storyStatus,
        total: tasks.length,
        by_status: {
          backlog: taskStatus.backlog ?? 0,
          todo: taskStatus.todo ?? 0,
          in_progress: taskStatus.in_progress ?? 0,
          in_review: taskStatus.in_review ?? 0,
          testing: taskStatus.testing ?? 0,
          done: taskStatus.done ?? 0,
          cancelled: taskStatus.cancelled ?? 0,
        },
        module_anchored: moduleAnchored,
        done_ratio: tasks.length
          ? Math.round(((taskStatus.done ?? 0) / tasks.length) * 100)
          : 0,
      };
      console.log(render(summary, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'bulk-create': {
      // 与 create 一致支持两种锚定：--story 或 --product + --module-id
      const storyId = opt(f, 'story', 'storyId');
      const productId = opt(f, 'product', 'project');
      const moduleId = opt(f, 'module-id', 'moduleId');
      if (!storyId && !(productId && moduleId)) {
        throw new Error(
          '用法: xcart task bulk-create --story <storyId> --file tasks.json ' +
          '| --product <productId> --module-id <slug> --file tasks.json'
        );
      }
      const file = req(f, 'file');
      const items: unknown[] = JSON.parse((await import('node:fs')).readFileSync(file, 'utf-8'));
      const created: unknown[] = [];
      for (const it of items) {
        if (!isObj(it) || typeof it.title !== 'string') throw new Error(`bulk-create 文件条目需含 title: ${JSON.stringify(it)}`);
        const res = await api('/api/dev-tasks', 'POST', {
          ...(storyId ? { storyId } : {}),
          ...(productId ? { productId } : {}),
          ...(moduleId ? { moduleId } : {}),
          title: it.title,
          description: it.description ?? '',
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
      const productId = req(f, 'product', 'project');
      const data = await api(`/api/milestones?productId=${encodeURIComponent(productId)}`);
      const rows = (Array.isArray(data) ? data : []).map((m) => ({
        id: m.id, name: m.name, status: m.status, goal: m.goal ?? '', target_date: m.target_date ?? '',
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'info': {
      // 里程碑详情 + 锚定的 ADR + 该版本交付时刻的宪法摘要（§3.7/§5）。
      // 权威方向是 ADR → milestone（adr_records.milestone_id）：milestone.adr_id 已作为死列删除
      // （domain-model.md §6.5），故此处按「哪些 ADR 锚定在本版本」反查，不读里程碑上的字段。
      const id = reqId(ctx.positional.slice(1), 'milestone info');
      const productId = opt(f, 'product', 'project');
      const milestones = await api(`/api/milestones?productId=${encodeURIComponent(productId ?? '')}`).catch(() => []);
      const milestone = (Array.isArray(milestones) ? milestones : []).find((m) => m.id === id);
      if (!milestone) {
        console.log(`✗ 未找到版本 ${id}${productId ? `（产品 ${productId}）` : '（可用 --product 限定产品）'}`);
        return;
      }
      const adrs = await api(`/api/adr-records?productId=${encodeURIComponent(milestone.product_id)}`).catch(() => []);
      const anchored = (Array.isArray(adrs) ? adrs : []).filter((a) => a?.milestone_id === id);
      let constitution: unknown = null;
      if (anchored.length > 0) {
        constitution = await api(
          `/api/adr-records/as-of-milestone?milestoneId=${encodeURIComponent(id)}`
        ).catch(() => null);
      }
      const out = {
        ...milestone,
        anchored_adrs: anchored.map((a) => ({ id: a.id, title: a.title, status: a.status, seq: a.seq })),
        // 未锚定 ADR 时不展示宪法（明确的未关联状态，不是错误）——见 TASK-532
        constitution_as_of: isObj(constitution)
          ? {
              tech_stack_count: (constitution.tech_stack ?? []).length,
              principles_count: (constitution.architecture_principles ?? []).length,
              modules_count: (constitution.modules ?? []).length,
            }
          : null,
      };
      console.log(render(out, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'create': {
      const body: Record<string, unknown> = {
        product_id: req(f, 'product', 'project'),
        name: req(f, 'name'),
      };
      const goal = opt(f, 'goal'); if (goal !== undefined) body.goal = goal;
      const date = opt(f, 'date', 'target-date'); if (date !== undefined) body.target_date = date;
      const status = opt(f, 'status'); if (status !== undefined) body.status = status;
      const prov = opt(f, 'provenance'); if (prov) body.provenance = prov;
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

// ---------- module（系统模块目录）----------
/** 模块身份是 (产品, slug)：detail/update/delete 需 --product 定位（slug 仅产品内唯一） */
async function cmdModule(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0];
  const f = ctx.flags;
  switch (sub) {
    case 'list': {
      const productId = req(f, 'product', 'project');
      const data = await api(`/api/system-modules?productId=${encodeURIComponent(productId)}`);
      const rows = (Array.isArray(data) ? data : []).map((m) => ({
        id: m.id, name: m.name, path: m.path ?? '', depends_on: (m.depends_on ?? []).join(','),
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'info': {
      const productId = req(f, 'product', 'project');
      const id = reqId(ctx.positional.slice(1), 'module info');
      const data = await api(`/api/system-modules/${id}?productId=${encodeURIComponent(productId)}`);
      console.log(render(data, ctx.format));
      break;
    }
    case 'create':
    case 'update': {
      const productId = req(f, 'product', 'project');
      const id = sub === 'create' ? (req(f, 'id') as string) : reqId(ctx.positional.slice(1), 'module update');
      const body: Record<string, unknown> = {
        id,
        product_id: productId,
        name: req(f, 'name'),
      };
      const pathOpt = opt(f, 'path'); if (pathOpt !== undefined) body.path = pathOpt;
      const resp = opt(f, 'responsibility'); if (resp !== undefined) body.responsibility = resp;
      const deps = splitList(opt(f, 'depends-on')); body.depends_on = deps;
      const prov = opt(f, 'provenance'); if (prov) body.provenance = prov;
      const data = await api(`/api/system-modules/${id}`, 'PUT', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'delete': {
      const productId = req(f, 'product', 'project');
      const id = reqId(ctx.positional.slice(1), 'module delete');
      const res = await api(`/api/system-modules/${id}?productId=${encodeURIComponent(productId)}`, 'DELETE');
      console.log(render(res, ctx.format));
      break;
    }
    default: throw new Error(`未知子命令: module ${sub ?? ''}\n\n${helpText()}`);
  }
}

// ---------- adr（技术宪法 / ADR）----------
/** 渲染折叠后的当前态（§3.3 投影）：tech_stack / architecture_principles / modules 三节 */
function renderConstitution(data: unknown, fmt: Format): void {
  if (fmt === 'json' || !isObj(data)) {
    console.log(render(data, 'json'));
    return;
  }
  const arr = (v: unknown): Record<string, any>[] => (Array.isArray(v) ? (v as Record<string, any>[]) : []);
  const sections: Array<[string, Record<string, unknown>[]]> = [
    ['技术栈 (tech_stack)', arr(data.tech_stack).map((t) => ({
      id: t.id, layer: t.layer, choice: t.choice, version: t.version ?? '', rationale: t.rationale ?? '',
    }))],
    ['架构原则 (architecture_principles)', arr(data.architecture_principles).map((p) => ({
      id: p.id, strength: p.strength, statement: p.statement, modules: (p.module_ids ?? []).join(','), rationale: p.rationale ?? '',
    }))],
    ['模块目录 (modules)', arr(data.modules).map((m) => ({
      id: m.id, name: m.name, path: m.path, responsibility: m.responsibility ?? '', depends_on: (m.depends_on ?? []).join(','),
    }))],
  ];
  for (const [title, rows] of sections) {
    console.log(fmt === 'markdown' ? `### ${title}` : title);
    console.log(render(rows, fmt));
    console.log('');
  }
}

async function cmdAdr(ctx: Ctx): Promise<void> {
  const sub = ctx.positional[0];
  const f = ctx.flags;
  switch (sub) {
    case 'create': {
      const body: Record<string, unknown> = {
        product_id: req(f, 'product', 'project'),
        title: req(f, 'title'),
        context: req(f, 'context'),
        decision: req(f, 'decision'),
      };
      const consequences = opt(f, 'consequences'); if (consequences !== undefined) body.consequences = consequences;
      const alternatives = opt(f, 'alternatives'); if (alternatives !== undefined) body.alternatives_considered = alternatives;
      const supersedes = opt(f, 'supersedes'); if (supersedes !== undefined) body.supersedes = supersedes;
      const milestone = opt(f, 'milestone'); if (milestone !== undefined) body.milestone_id = milestone;
      const modules = splitList(opt(f, 'modules')); if (modules) body.module_ids = modules;
      const status = opt(f, 'status'); if (status !== undefined) body.status = status;
      const file = opt(f, 'file');
      if (file !== undefined) body.changes = JSON.parse(readFileSync(file, 'utf-8'));
      const prov = opt(f, 'provenance'); if (prov) body.provenance = prov;
      const data = await api('/api/adr-records', 'POST', body);
      console.log(render(data, ctx.format));
      break;
    }
    case 'list': {
      const productId = req(f, 'product', 'project');
      const data = await api(`/api/adr-records?productId=${encodeURIComponent(productId)}`);
      const rows = (Array.isArray(data) ? data : []).map((r) => ({
        id: r.id, seq: r.seq, status: r.status, title: r.title,
      }));
      console.log(render(rows, ctx.format));
      break;
    }
    case 'show': {
      const id = reqId(ctx.positional.slice(1), 'adr show');
      const data = await api(`/api/adr-records/${id}`);
      console.log(render(data, ctx.format === 'table' ? 'json' : ctx.format));
      break;
    }
    case 'status': {
      const id = reqId(ctx.positional.slice(1), 'adr status <id> <status>');
      const status = ctx.positional[2];
      if (!status) throw new Error('用法: xcart adr status <id> <status> [--reason]');
      const res = await api(`/api/adr-records/${id}/status`, 'POST', { status, reason: opt(f, 'reason') });
      console.log(render(res, ctx.format));
      break;
    }
    case 'current': {
      const productId = req(f, 'product', 'project');
      const data = await api(`/api/adr-records/current?productId=${encodeURIComponent(productId)}`);
      renderConstitution(data, ctx.format);
      break;
    }
    case 'as-of-milestone': {
      const milestoneId = ctx.positional[1];
      if (!milestoneId) throw new Error('用法: xcart adr as-of-milestone <milestoneId>');
      const data = await api(`/api/adr-records/as-of-milestone?milestoneId=${encodeURIComponent(milestoneId)}`);
      renderConstitution(data, ctx.format);
      break;
    }
    default: throw new Error(`未知子命令: adr ${sub ?? ''}\n\n${helpText()}`);
  }
}

// ---------- status ----------
async function cmdCtx(ctx: Ctx): Promise<void> {
  const taskId = ctx.positional[0];
  if (!taskId) throw new Error('用法: xcart ctx <taskId>');
  const data = (await api(`/api/ctx/${encodeURIComponent(taskId)}`)) as unknown;
  if (!isObj(data)) { console.log('未找到'); return; }
  if ('error' in data && typeof data.error === 'string') { console.log(`✗ ${data.error}`); return; }

  const out = data as {
    task: { id: string; title: string; description: string; status: string; priority: string; tags: string[]; story_id: string | null; module_id: string | null; product_id: string | null };
    story: { id: string; title: string; status: string; priority: string; acceptance_criteria: string[]; milestone_id: string | null } | null;
    modules: Array<{ id: string; name: string; responsibility: string; path: string; depends_on: string[]; depended_by: string[] }>;
    principles: Array<{ id: string; statement: string; strength: string; module_ids: string[] }>;
    dependencies: { upstream: Array<{ id: string; title: string; status: string; done: boolean }>; downstream: Array<{ id: string; title: string; status: string }> };
    siblings: Array<{ id: string; title: string; status: string }>;
    ledger: Array<{ entity_id: string; previous_status: string; new_status: string; reason: string | null; changed_by: string | null; changed_at: string }>;
  };

  const lines: string[] = [];
  lines.push(`# 任务上下文：${out.task.id}`);
  lines.push('');
  lines.push(`**${out.task.title}**`);
  lines.push('');
  lines.push(`- 状态: ${out.task.status} | 优先级: ${out.task.priority} | 锚定: ${out.task.module_id ?? (out.task.story_id ? `story:${out.task.story_id}` : '无')}`);
  if (out.task.tags.length) lines.push(`- 标签: ${out.task.tags.join(', ')}`);
  if (out.task.description) { lines.push(''); lines.push(out.task.description); }

  lines.push('');
  lines.push('## 意图（做到什么算对）');
  if (out.story) {
    lines.push(`- ${out.story.id} [${out.story.status}] ${out.story.title}`);
    if (out.story.acceptance_criteria.length) {
      lines.push('- 验收标准:');
      for (const ac of out.story.acceptance_criteria) lines.push(`  - ${typeof ac === 'string' ? ac : JSON.stringify(ac)}`);
    }
  } else {
    lines.push('-（无 story 锚定：工程治理类任务，对照下方模块职责）');
  }

  lines.push('');
  lines.push('## 结构与规矩（怎么做才合规）');
  for (const m of out.modules) {
    lines.push(`- **${m.id}** ${m.name}（${m.path}）`);
    if (m.responsibility) lines.push(`  职责: ${m.responsibility}`);
    if (m.depends_on.length) lines.push(`  依赖: ${m.depends_on.join(', ')}`);
    if (m.depended_by.length) lines.push(`  被依赖: ${m.depended_by.join(', ')}`);
  }
  if (out.principles.length) {
    lines.push('- 架构原则:');
    for (const p of out.principles) {
      lines.push(`  - [${p.strength}] ${p.statement}${p.module_ids.length ? `（生效范围: ${p.module_ids.join(', ')}）` : '（全局）'}`);
    }
  } else {
    lines.push('-（涉事模块暂无生效的架构原则）');
  }

  lines.push('');
  lines.push('## 实现（依赖与兄弟）');
  const blocked = out.dependencies.upstream.filter((d) => !d.done);
  if (out.dependencies.upstream.length) {
    lines.push(`- 上游依赖: ${out.dependencies.upstream.map((d) => `${d.id}[${d.status}]${d.done ? '' : ' ⚠未完成'}`).join(', ')}`);
    if (blocked.length) lines.push(`- ⚠ ${blocked.length} 条上游未完成，动工前先确认`);
  } else {
    lines.push('- 无上游依赖');
  }
  if (out.dependencies.downstream.length) {
    lines.push(`- 下游（依赖本任务）: ${out.dependencies.downstream.map((d) => `${d.id}[${d.status}]`).join(', ')}`);
  }
  if (out.siblings.length) {
    lines.push(`- 同模块兄弟: ${out.siblings.slice(0, 6).map((s) => `${s.id}[${s.status}]`).join(', ')}${out.siblings.length > 6 ? ` …共 ${out.siblings.length}` : ''}`);
  }

  lines.push('');
  lines.push('## 证据（账本近况）');
  if (out.ledger.length === 0) lines.push('-（无）');
  for (const l of out.ledger) {
    lines.push(`- ${l.changed_at.slice(0, 10)} ${l.entity_id}: ${l.previous_status} → ${l.new_status}${l.reason ? `（${l.reason.slice(0, 60)}）` : ''}`);
  }
  console.log(lines.join('\n'));
}

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
    case 'ratify': {
      // 约束写入的人事追认（§6.7 方案 B）：constraint_written → ratified
      const entityType = ctx.positional[1];
      const entityId = ctx.positional[2];
      const reason = opt(ctx.flags, 'reason') ?? opt(ctx.flags, 'm');
      if (!entityType || !entityId || !reason) {
        throw new Error(
          '用法: xcart status ratify <story|system_module|user_activity|product|user_task|milestone> <entityId> --reason "理由（必填）"'
        );
      }
      const validTypes = ['story', 'system_module', 'user_activity', 'product', 'user_task', 'milestone'];
      if (!validTypes.includes(entityType)) {
        throw new Error(`非法实体类型: ${entityType}（可选: ${validTypes.join(' | ')}）`);
      }
      await api('/api/status-changes/ratify', 'POST', {
        entityType,
        entityId,
        reason,
        changedBy: opt(ctx.flags, 'by') ?? 'human:cli',
      });
      console.log(`✓ 已追认 ${entityType}/${entityId}`);
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

/**
 * 约束追溯（§2.3 两分的读路径）：story/module/adr 三入口任选其一，
 * 输出「意图 → 结构 → 规矩 → 实现」链。纯读。
 */
async function cmdTrace(ctx: Ctx): Promise<void> {
  const [kind, id] = ctx.positional;
  if (!kind || !id || !['story', 'module', 'adr'].includes(kind)) {
    throw new Error('用法: xcart trace <story|module|adr> <entityId>');
  }
  const param = kind === 'story' ? 'storyId' : kind === 'module' ? 'moduleId' : 'adrId';
  const data = (await api(`/api/trace?${param}=${encodeURIComponent(id)}`)) as unknown;
  if (!isObj(data)) { console.log('未找到'); return; }
  if ('error' in data && typeof data.error === 'string') { console.log(`✗ ${data.error}`); return; }

  const out = data as {
    entry: { kind: string; id: string };
    product_id: string;
    stories: Array<{ id: string; title: string; status: string; affected_modules: string[] }>;
    modules: Array<{ id: string; name: string }>;
    adrs: Array<{ id: string; title: string; status: string }>;
    tasks: Array<{ id: string; title: string; status: string; story_id: string | null; module_id: string | null }>;
  };

  const lines: string[] = [];
  lines.push(`## 追溯：${kind} ${id}（产品 ${out.product_id}）`);
  lines.push('');
  lines.push('### 用户故事（意图）');
  if (out.stories.length === 0) lines.push('-（无）');
  for (const s of out.stories) {
    const mods = s.affected_modules ?? [];
    lines.push(`- ${s.id} [${s.status}] ${s.title}${mods.length ? `（涉及: ${mods.join(', ')}）` : ''}`);
  }
  lines.push('');
  lines.push('### 系统模块（结构）');
  if (out.modules.length === 0) lines.push('-（无）');
  for (const m of out.modules) lines.push(`- ${m.id}${m.name ? ` ${m.name}` : ''}`);
  lines.push('');
  lines.push('### 架构决策（规矩）');
  if (out.adrs.length === 0) lines.push('-（无）');
  for (const a of out.adrs) lines.push(`- ${a.id} [${a.status}] ${a.title}`);
  lines.push('');
  lines.push('### 研发任务（实现）');
  if (out.tasks.length === 0) lines.push('-（无）');
  for (const t of out.tasks) {
    const anchor = t.story_id ? `story:${t.story_id}` : t.module_id ? `module:${t.module_id}` : '未锚定';
    lines.push(`- ${t.id} [${t.status}] ${t.title}（${anchor}）`);
  }
  console.log(lines.join('\n'));
}

// ---------- context / overview ----------
// 树直读：project API 返回的 user_activities[].stories[].tasks 已含全字段，
// 不再逐 story 发起 N+1 请求（原实现对 41 故事的项目 = 42 次 HTTP）。

type TreeJourney = {
  id?: string; name?: string;
  stories?: Array<{ id?: string; title?: string; description?: string; status?: string;
    priority?: string; estimation?: number;
    /** 故事所属版本（未排期为空/缺省） */
    milestone_id?: string;
    /** 深树字段名是 dev_tasks（product.repository 的映射），非 tasks */
    dev_tasks?: Array<{ status?: string }> }>;
};

/** 单个版本的 planned vs done 统计（SAFe Program Predictability 口径，US-112） */
export type MilestonePredictability = {
  milestone_id: string;
  planned_stories: number;
  done_stories: number;
  planned_estimation: number;
  done_estimation: number;
  /** done/planned 比值（0-1）；planned 为 0 时 null（不是 0——没有计划不等于达成 0） */
  predictability: number | null;
};

/**
 * 按版本聚合 planned vs done（故事数 + 估算工时）。
 *
 * 口径（US-112）：
 * - planned = 挂在该版本下的故事（含 cancelled？**不含**——放弃的需求不应拉低可预测性，
 *   它是范围的显式收缩，不是未达成。故 cancelled 从分子分母同时剔除）
 * - done = 状态 accepted 的故事（故事侧收口语义，见 domain-saga §6.3）
 * - estimation 缺失按 0 计（不猜）
 * - 未排期故事（milestone_id 空）单独归入 `unassigned`，不混进任何版本的分母
 */
function aggregateByMilestone(activities: TreeJourney[]): {
  byMilestone: Record<string, MilestonePredictability>;
  unassigned: { planned_stories: number; done_stories: number; planned_estimation: number; done_estimation: number };
} {
  const byMilestone: Record<string, MilestonePredictability> = {};
  const unassigned = { planned_stories: 0, done_stories: 0, planned_estimation: 0, done_estimation: 0 };

  for (const activity of activities) {
    for (const story of activity.stories ?? []) {
      if ((story.status ?? 'backlog') === 'cancelled') continue;
      const estimation = typeof story.estimation === 'number' ? story.estimation : 0;
      const isDone = story.status === 'accepted';
      const bucket = story.milestone_id
        ? (byMilestone[story.milestone_id] ??= {
            milestone_id: story.milestone_id,
            planned_stories: 0, done_stories: 0, planned_estimation: 0, done_estimation: 0, predictability: null,
          })
        : unassigned;
      bucket.planned_stories += 1;
      bucket.planned_estimation += estimation;
      if (isDone) {
        bucket.done_stories += 1;
        bucket.done_estimation += estimation;
      }
    }
  }

  for (const m of Object.values(byMilestone)) {
    m.predictability = m.planned_stories > 0 ? Math.round((m.done_stories / m.planned_stories) * 100) / 100 : null;
  }
  return { byMilestone, unassigned };
}

/**
 * 汇总统计（故事来自项目深树，任务来自 `/all` 全量）。
 *
 * **任务必须外部传入**：深树（user_activities[].stories[].dev_tasks[]）看不到
 * 模块锚定的工程治理任务（story_id=null，domain-model §2.5），只按深树统计会
 * 系统性漏掉它们。故事必然挂在活动下，深树对故事是完备的，故仍从树取。
 */
function summarizeTree(
  proj: Record<string, unknown>,
  tasks: Array<Record<string, unknown>>
): {
  activities: TreeJourney[];
  storyCount: number; doneStories: number;
  taskCount: number; doneTasks: number;
  taskStatus: Record<string, number>;
  storyStatus: Record<string, number>;
  byMilestone: Record<string, MilestonePredictability>;
  unassigned: { planned_stories: number; done_stories: number; planned_estimation: number; done_estimation: number };
} {
  const activities: TreeJourney[] = (Array.isArray(proj.user_activities) ? proj.user_activities : []) as TreeJourney[];
  let storyCount = 0, doneStories = 0;
  const storyStatus: Record<string, number> = {};
  for (const j of activities) {
    for (const s of Array.isArray(j.stories) ? j.stories : []) {
      storyCount++;
      const ss = s.status ?? 'backlog';
      storyStatus[ss] = (storyStatus[ss] ?? 0) + 1;
      if (ss === 'accepted') doneStories++;
    }
  }
  const taskStatus: Record<string, number> = {};
  let doneTasks = 0;
  for (const t of tasks) {
    const ts = String(t.status ?? 'backlog');
    taskStatus[ts] = (taskStatus[ts] ?? 0) + 1;
    if (ts === 'done') doneTasks++;
  }
  const { byMilestone, unassigned } = aggregateByMilestone(activities);
  return {
    activities, storyCount, doneStories,
    taskCount: tasks.length, doneTasks, taskStatus, storyStatus, byMilestone, unassigned,
  };
}

async function cmdContextExport(projectId: string, fmt: Format): Promise<void> {
  const proj = await api(`/api/products/${projectId}`);
  if (!isObj(proj) || !proj.id) throw new Error(`项目不存在: ${projectId}`);
  const milestones = await api(`/api/milestones?productId=${encodeURIComponent(projectId)}`).catch(() => []);
  // 技术宪法摘要（容错：无 ADR 时降级空宪法，不得让 context export 整体失败）
  const constitution = await api(`/api/adr-records/current?productId=${encodeURIComponent(projectId)}`).catch(() => ({
    tech_stack: [], architecture_principles: [], modules: [],
  }));
  const constObj = isObj(constitution) ? constitution : { tech_stack: [], architecture_principles: [], modules: [] };
  const all = await api(`/api/dev-tasks/all?productId=${encodeURIComponent(projectId)}`).catch(() => []);
  const allTasks: Array<Record<string, unknown>> = Array.isArray(all) ? all : [];
  const { activities: treeActivities, storyCount, taskCount, doneTasks } = summarizeTree(proj, allTasks);
  const activityBlocks: string[] = [];
  for (const j of treeActivities) {
    const stories = Array.isArray(j.stories) ? j.stories : [];
    const storyBlocks = stories.map((s: Record<string, unknown>) => {
      const devTasks = Array.isArray(s.dev_tasks) ? s.dev_tasks : [];
      return `- [${s.status ?? 'backlog'}] **${s.title}** (${s.id}, priority=${s.priority}, ${s.estimation}h)`
      + (devTasks.length ? ` — ${devTasks.length} 研发任务` : '')
      + `\n  ${(String(s.description ?? '')).split('\n')[0] || ''}`;
    });
    activityBlocks.push(`### ${j.name} (${j.id})\n${storyBlocks.join('\n\n')}`);
  }
  const principleLines = (Array.isArray(constObj.architecture_principles) ? constObj.architecture_principles : [])
    .map((p: Record<string, unknown>) => `- [${p.strength}] ${p.statement} (${p.id})`);
  const moduleLines = (Array.isArray(constObj.modules) ? constObj.modules : [])
    .map((m: Record<string, unknown>) => `- **${m.name}** (${m.id}) — ${m.path}`);
  const techLines = (Array.isArray(constObj.tech_stack) ? constObj.tech_stack : [])
    .map((t: Record<string, unknown>) => `- ${t.choice}（${t.layer}）`);
  const constitutionSection = `## 技术宪法\n
### 技术栈\n${techLines.join('\n') || '-（暂无）'}\n
### 架构原则\n${principleLines.join('\n') || '-（暂无）'}\n
### 模块目录\n${moduleLines.join('\n') || '-（暂无）'}\n`;
  // 模块锚定的工程治理任务不在故事地图里（story_id=null，§2.5）——必须单列，
  // 否则它们只出现在总数里，读者无法定位（「总数 39 但地图上找不到」）
  const governance = allTasks.filter((t) => t.story_id === null);
  const governanceSection = governance.length
    ? `## 工程治理任务（模块锚定，不在故事地图内）\n${
        governance
          .map((t) => `- [${t.status}] **${t.title}** (${t.id}, 模块=${t.module_id ?? '-'}, ${t.estimation ?? 0}h)`)
          .join('\n')
      }\n`
    : '';
  const md = `# ${proj.name} — 全景上下文\n
> 产品: ${proj.id} | 描述: ${proj.description ?? '-'}\n
## 统计\n
- 用户活动: ${treeActivities.length} | 故事: ${storyCount} | 研发任务: ${taskCount}（完成 ${doneTasks}，其中模块锚定 ${governance.length}）\n
- 发布: ${(Array.isArray(milestones) ? milestones : []).map((m) => `${m.name}(${m.status})`).join(', ') || '-'}\n
${constitutionSection}
${governanceSection}
## 故事地图（用户活动 × 用户故事）\n
${activityBlocks.join('\n\n')}\n`;
  if (fmt === 'markdown') console.log(md);
  else if (fmt === 'json') console.log(JSON.stringify({
    product: { id: proj.id, name: proj.name, description: proj.description },
    milestones,
    constitution: constObj,
    activities: treeActivities,
    // 与 activities 并列（而非嵌进某个活动）——它们不属任何活动列
    module_anchored_tasks: governance,
  }, null, 2));
  else console.log(JSON.stringify(md, null, 2));
}


async function cmdOverview(ctx: Ctx): Promise<void> {
  const projectId = req(ctx.flags, 'project', 'projectId');
  const proj = await api(`/api/products/${projectId}`);
  if (!isObj(proj) || !proj.id) throw new Error(`项目不存在: ${projectId}`);
  const constitution = await api(`/api/adr-records/current?productId=${encodeURIComponent(projectId)}`).catch(() => ({
    tech_stack: [], architecture_principles: [], modules: [],
  }));
  const constObj = isObj(constitution) ? constitution : { tech_stack: [], architecture_principles: [], modules: [] };
  const principles = Array.isArray(constObj.architecture_principles) ? constObj.architecture_principles : [];
  const mustPrinciples = principles.filter((p: Record<string, unknown>) => p.strength === 'MUST').length;
  // 任务计数走 /all（repo 全量）：深树看不到模块锚定任务（§2.5）
  const all = await api(`/api/dev-tasks/all?productId=${encodeURIComponent(projectId)}`).catch(() => []);
  const allTasks: Array<Record<string, unknown>> = Array.isArray(all) ? all : [];
  const { activities, storyCount, doneStories, taskCount, doneTasks, taskStatus, storyStatus, byMilestone, unassigned } = summarizeTree(proj, allTasks);
  const moduleAnchored = allTasks.filter((t) => t.story_id === null).length;
  if (ctx.format === 'json') {
    console.log(JSON.stringify({
      project_id: proj.id, name: proj.name,
      activities: activities.length, stories: storyCount, done_stories: doneStories,
      tasks: taskCount, done_tasks: doneTasks, module_anchored_tasks: moduleAnchored,
      task_status: taskStatus, story_status: storyStatus,
      // 按版本的 planned vs done（US-112 PI 可预测性；cancelled 已剔除，未排期单列）
      milestone_predictability: byMilestone,
      unassigned_stories: unassigned,
      constitution: {
        tech_stack_count: Array.isArray(constObj.tech_stack) ? constObj.tech_stack.length : 0,
        principles_count: principles.length,
        must_principles_count: mustPrinciples,
        modules_count: Array.isArray(constObj.modules) ? constObj.modules.length : 0,
      },
    }, null, 2));
    return;
  }
  const predictabilityLines = Object.values(byMilestone)
    .map((m) => `  - ${m.milestone_id}: ${m.done_stories}/${m.planned_stories} 故事（${m.done_estimation}/${m.planned_estimation}h）可预测性 ${m.predictability ?? '-'}`)
    .join('\n');
  const md = `# ${proj.name} — 产品总览\n
- 用户活动: ${activities.length}\n- 故事: ${storyCount}（完成 ${doneStories}）\n- 研发任务: ${taskCount}（完成 ${doneTasks}，其中模块锚定 ${moduleAnchored}）\n- 任务状态: ${JSON.stringify(taskStatus)}\n- 故事状态: ${JSON.stringify(storyStatus)}\n- 技术宪法: ${principles.length} 原则（MUST ${mustPrinciples}）/ ${Array.isArray(constObj.tech_stack) ? constObj.tech_stack.length : 0} 技术栈 / ${Array.isArray(constObj.modules) ? constObj.modules.length : 0} 模块\n- 版本可预测性（done/planned，故事数）:\n${predictabilityLines || '  -（无已排期故事）'}\n`;
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
      const { cpSync, existsSync, mkdirSync, readdirSync } = await import('node:fs');
      const explicit = opt(f, 'dir');
      const targets = explicit
        ? [explicit]
        : [`${repoRoot}.claude/skills`];
      if (!existsSync(skillsDir)) throw new Error(`skills 目录不存在: ${skillsDir}`);
      const dirs = readdirSync(skillsDir).filter((d) => !d.startsWith('.'));
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
  }
}

// ─── 旧命令别名（向后兼容）──────────────────────────────────
const LEGACY: Record<string, string[]> = {
  products: ['product', 'list'],
  milestones: ['milestone', 'list'],
};
async function cmdLegacy(ctx: Ctx, where: string): Promise<void> {
  switch (where) {
    case 'products': return cmdProduct({ ...ctx, positional: ['list'] });
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

产品 / 项目
  xcart product list
  xcart project info --id <id>
  xcart project create --name <name> [--description] [--tech-stack a,b]
  xcart project update <id> [--name] [--description]
  xcart project delete <id>

用户活动（故事地图骨干列；journey 为 deprecated alias）
  xcart activity list --product <id>
  xcart activity info <id>                       # 该活动下的故事
  xcart activity create --product <id> --name <n> [--description] [--order]
  xcart activity update <id> [--name] [--description] [--order]
  xcart activity delete <id>

用户故事
  xcart story list --activity <id>
  xcart story update <id> [--title] [--priority] [--status] [--activity <id>|none] [--user-task <id>|none] [--milestone <id>|none] [--estimation]
  xcart story move <id> <activityId>            # 跨活动移动故事（= update --activity）
  xcart story create --activity <id> --title <t> [--priority] [--estimation] [--ac "a;b"] [--tags a,b]
  xcart story status <id> <status> [--reason]
  xcart story delete <id>
  xcart story bulk-create --activity <id> --file stories.json

用户任务（活动下的操作步骤，故事地图第二层；与研发任务 DevTask 不同空间）
  xcart user-task list --activity <id> | --product <id>
  xcart user-task create --activity <id> --name <n> [--description] [--order]
  xcart user-task update <id> [--name] [--description] [--order]
  xcart user-task delete <id>

研发任务（DevTask；task 为 deprecated alias）
  两种锚定（domain-model §2.5）：① --story（有用户价值的工作项）
                           ② --product + --module-id（工程治理类：重构/技术债，不进故事地图）
  xcart dev-task list --story <id> | --product <id> | --module-id <slug>
  xcart task info <id>
  xcart task create --story <id> --title <t> [--priority] [--estimation] [--deps a,b] [--tags a,b]
  xcart task create --product <id> --module-id <slug> --title <t> [--priority] [--estimation]
  xcart task update <id> [--title] [--status] [--assignee] [--priority] [--estimation] [--module-id <slug>] [--story <id>|none] [--product <id>]
  xcart task status <id> <status> [--expected-status <s>] [--reason]
                                                # --expected-status 启用 CAS 乐观锁：与当前状态不符时返回 409（防并发认领冲突，Agent 收到 409 应重读状态而非重试）
  xcart task delete <id>
  xcart task next --project <id> [--assignee]   # 下一个可执行任务（拓扑规则；两种锚定都参与）
  xcart task summary --project <id>             # 任务统计（含 module_anchored 计数）
  xcart task bulk-create --story <id> --file tasks.json | --product <id> --module-id <slug> --file tasks.json

注：任务无 --type 参数（type 字段已废除，交付性质由 --tags 承载，如 architecture-enabler/implementation/refactor/bug）。

版本 / 里程碑
  xcart milestone list --project <id>
  xcart milestone info <id> [--product <pid>]      # 版本详情 + 锚定到本版本的 ADR + 交付时刻宪法摘要（未锚定则不展示）
  xcart milestone create --project <id> --name <n> [--goal] [--date] [--status]
  xcart milestone update <id> [--name] [--goal] [--date] [--status]
  xcart milestone delete <id>

系统模块（SystemModule 目录；ADR 的 module_ids / Story 的 affected_modules 引用此处的 slug）
  xcart module list --project <id>
  xcart module info <slug> --project <id>
  xcart module create --project <id> --id <slug> --name <n> [--path <p>] [--responsibility <r>] [--depends-on a,b] [--provenance]
  xcart module update <slug> --project <id> [--name] [--path] [--responsibility] [--depends-on a,b]
  xcart module delete <slug> --project <id>

技术宪法 (ADR)
  xcart adr create --project <id> --title <t> --context <c> --decision <d> [--consequences] [--alternatives] [--supersedes <adrId>] [--milestone <id>] [--modules a,b] [--status proposed|accepted] [--file changes.json]
  xcart adr list --project <id>                 # 决策记录账本（仅追加）
  xcart adr show <adrId>
  xcart adr status <adrId> <status> --reason <r>
  xcart adr current --project <id>              # 当前态（按 seq 折叠 accepted ADR 的 changes）
  xcart adr as-of-milestone <milestoneId>       # 截至里程碑锚点的架构态

状态历史
  xcart status history <entityId>
  xcart status all
  xcart status ratify <story|system_module|user_activity|product|user_task|milestone> <id> --reason "…"
                                                # 约束写入的人事追认（§6.7 方案 B；理由必填）

上下文 / 总览
  xcart context export <projectId>              # 项目全景 Markdown（供 LLM）
  xcart overview --project <id>                 # 项目总览统计
  xcart trace <story|module|adr> <id>           # 约束追溯链（意图→结构→规矩→实现）
  xcart ctx <taskId>                            # 任务上下文切片（Agent 动工前必读）

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

Agent 使用提示
  - 数据统计用单命令聚合：'overview --format json'（一次 API 完成，勿逐 story 拉 task list）
  - 'context export' 默认 Markdown；'--format json' 得结构化数据（树内含任务明细）
  - estimation 单位=AI-Native 研发工时（小时）：按 coding agent 执行评估，非人工人天；任务约 2-4h/个
  - 可用参照: 简单 2-3h、中等 5-8h、复杂 13h+、完整模块 1-2 天
  - skills 含排期语义：xcart skill install 后见 skills/xcart-*/SKILL.md「排期评估」节
  - 输出已瘦身（project list description 截断）；需要全量用 'project info --id'
  - 解析 CLI 输出 JSON 优先用 jq（1 行指令、失败面窄），非 python/node 内联脚本
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
      case 'product':
      case 'project': // deprecated alias
        await cmdProduct(ctx); break;
      case 'activity':
      case 'journey': // deprecated alias
        await cmdUserActivity(ctx); break;
      case 'user-task': await cmdUserTask(ctx); break;
      case 'story': await cmdStory(ctx); break;
      case 'dev-task':
      case 'task': // deprecated alias
        await cmdDevTask(ctx); break;
      case 'milestone': await cmdMilestone(ctx); break;
      case 'module': await cmdModule(ctx); break;
      case 'adr': await cmdAdr(ctx); break;
      case 'status': await cmdStatus(ctx); break;
      case 'overview': await cmdOverview(ctx); break;
      case 'trace': await cmdTrace(ctx); break;
      case 'ctx': await cmdCtx(ctx); break;
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
        await cmdDevTask({ ...ctx, positional: ['status', id, status] });
        break;
      }
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
