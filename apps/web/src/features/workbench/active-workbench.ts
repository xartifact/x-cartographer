/**
 * 并行工作台 — 纯数据聚合逻辑（多产品活跃需求/活跃研发任务）
 *
 * 输入：GET /api/products 返回的完整产品树（user_activities → stories → dev_tasks）。
 * 输出：跨产品聚合的活跃需求 / 活跃任务 / 待办池，全部在客户端完成，无后端改动。
 */
import type { Product, DevTask, UserStory } from '@x-cartographer/shared';

/** 活跃需求（故事）状态 */
export const ACTIVE_STORY_STATUSES = ['todo', 'in_progress'] as const;
/** 活跃任务状态 */
export const ACTIVE_TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'testing'] as const;
/** 待办池（未启动）——默认折叠，可由 UI 开关展开 */
export const BACKLOG_STORY_STATUSES = ['backlog'] as const;
export const BACKLOG_TASK_STATUSES = ['backlog'] as const;

/** 带产品归属的活跃需求卡片数据 */
export interface ActiveStory extends UserStory {
  product_id: string;
  product_name: string;
  activity_id: string;
  activity_name: string;
  /** 该故事下的活跃任务数 */
  active_task_count: number;
}

/** 带产品/故事归属的活跃任务卡片数据 */
export interface ActiveTask extends DevTask {
  product_id: string;
  product_name: string;
  story_id: string;
  story_title: string;
}

export interface WorkbenchData {
  /** 并行中的产品数（含用户活动的产品） */
  productCount: number;
  activeStories: ActiveStory[];
  activeTasks: ActiveTask[];
  backlogStories: ActiveStory[];
  backlogTasks: ActiveTask[];
}

export function isActiveStoryStatus(s: string | undefined): boolean {
  return !!s && (ACTIVE_STORY_STATUSES as readonly string[]).includes(s);
}
export function isActiveTaskStatus(s: string | undefined): boolean {
  return !!s && (ACTIVE_TASK_STATUSES as readonly string[]).includes(s);
}
export function isBacklogStoryStatus(s: string | undefined): boolean {
  return !!s && (BACKLOG_STORY_STATUSES as readonly string[]).includes(s);
}
export function isBacklogTaskStatus(s: string | undefined): boolean {
  return !!s && (BACKLOG_TASK_STATUSES as readonly string[]).includes(s);
}

/** 把完整产品树压平为并行工作台数据 */
export function flattenProducts(products: Product[] | undefined | null): WorkbenchData {
  const activeStories: ActiveStory[] = [];
  const activeTasks: ActiveTask[] = [];
  const backlogStories: ActiveStory[] = [];
  const backlogTasks: ActiveTask[] = [];

  for (const product of products ?? []) {
    for (const activity of product.user_activities ?? []) {
      for (const story of activity.stories ?? []) {
        const tasks = story.dev_tasks ?? [];
        const activeTaskCount = tasks.filter((t) => isActiveTaskStatus(t.status)).length;
        const base: ActiveStory = {
          ...story,
          product_id: product.id,
          product_name: product.name,
          activity_id: activity.id,
          activity_name: activity.name,
          active_task_count: activeTaskCount,
        };
        if (isActiveStoryStatus(story.status)) activeStories.push(base);
        else if (isBacklogStoryStatus(story.status)) backlogStories.push(base);

        for (const task of tasks) {
          const card: ActiveTask = {
            ...task,
            product_id: product.id,
            product_name: product.name,
            story_id: story.id,
            story_title: story.title,
          };
          // 一个任务只归入一个集合（活跃优先；backlog 归待办池）
          if (isActiveTaskStatus(task.status)) activeTasks.push(card);
          else if (isBacklogTaskStatus(task.status)) backlogTasks.push(card);
        }
      }
    }
  }

  // 稳定排序：按产品名 → id
  const byProduct = (a: { product_name: string; id: string }, b: { product_name: string; id: string }) =>
    a.product_name.localeCompare(b.product_name) || a.id.localeCompare(b.id);

  return {
    productCount: products?.length ?? 0,
    activeStories: activeStories.sort(byProduct),
    activeTasks: activeTasks.sort(byProduct),
    backlogStories: backlogStories.sort(byProduct),
    backlogTasks: backlogTasks.sort(byProduct),
  };
}

/** 标题搜索过滤 */
export function filterByQuery<T extends { title: string }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((it) => it.title.toLowerCase().includes(q));
}

/** 按产品分组（保持排序） */
export function groupByProduct<T extends { product_id: string; product_name: string }>(
  items: T[]
): Array<{ product_id: string; product_name: string; items: T[] }> {
  const map = new Map<string, { product_id: string; product_name: string; items: T[] }>();
  for (const it of items) {
    let g = map.get(it.product_id);
    if (!g) {
      g = { product_id: it.product_id, product_name: it.product_name, items: [] };
      map.set(it.product_id, g);
    }
    g.items.push(it);
  }
  return [...map.values()];
}
