/**
 * 并行工作台 — 纯数据聚合逻辑（多项目活跃需求/活跃任务）
 *
 * 输入：GET /api/projects 返回的完整项目树（journeys → stories → tasks）。
 * 输出：跨项目聚合的活跃需求 / 活跃任务 / 待办池，全部在客户端完成，无后端改动。
 */
import type { Project, Task, UserStory } from '@x-cartographer/shared';

/** 活跃需求（故事）状态 */
export const ACTIVE_STORY_STATUSES = ['todo', 'in_progress'] as const;
/** 活跃任务状态 */
export const ACTIVE_TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'testing'] as const;
/** 待办池（未启动）——默认折叠，可由 UI 开关展开 */
export const BACKLOG_STORY_STATUSES = ['backlog'] as const;
export const BACKLOG_TASK_STATUSES = ['backlog'] as const;

/** 带项目归属的活跃需求卡片数据 */
export interface ActiveStory extends UserStory {
  project_id: string;
  project_name: string;
  journey_id: string;
  journey_name: string;
  /** 该故事下的活跃任务数 */
  active_task_count: number;
}

/** 带项目/故事归属的活跃任务卡片数据 */
export interface ActiveTask extends Task {
  project_id: string;
  project_name: string;
  story_id: string;
  story_title: string;
}

export interface WorkbenchData {
  /** 并行中的项目数（含用户旅程的项目） */
  projectCount: number;
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

/** 把完整项目树压平为并行工作台数据 */
export function flattenProjects(projects: Project[] | undefined | null): WorkbenchData {
  const activeStories: ActiveStory[] = [];
  const activeTasks: ActiveTask[] = [];
  const backlogStories: ActiveStory[] = [];
  const backlogTasks: ActiveTask[] = [];

  for (const project of projects ?? []) {
    for (const journey of project.user_journeys ?? []) {
      for (const story of journey.stories ?? []) {
        const tasks = story.tasks ?? [];
        const activeTaskCount = tasks.filter((t) => isActiveTaskStatus(t.status)).length;
        const base: ActiveStory = {
          ...story,
          project_id: project.id,
          project_name: project.name,
          journey_id: journey.id,
          journey_name: journey.name,
          active_task_count: activeTaskCount,
        };
        if (isActiveStoryStatus(story.status)) activeStories.push(base);
        else if (isBacklogStoryStatus(story.status)) backlogStories.push(base);

        for (const task of tasks) {
          const card: ActiveTask = {
            ...task,
            project_id: project.id,
            project_name: project.name,
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

  // 稳定排序：按项目名 → id
  const byProject = (a: { project_name: string; id: string }, b: { project_name: string; id: string }) =>
    a.project_name.localeCompare(b.project_name) || a.id.localeCompare(b.id);

  return {
    projectCount: projects?.length ?? 0,
    activeStories: activeStories.sort(byProject),
    activeTasks: activeTasks.sort(byProject),
    backlogStories: backlogStories.sort(byProject),
    backlogTasks: backlogTasks.sort(byProject),
  };
}

/** 标题搜索过滤 */
export function filterByQuery<T extends { title: string }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((it) => it.title.toLowerCase().includes(q));
}

/** 按项目分组（保持排序） */
export function groupByProject<T extends { project_id: string; project_name: string }>(
  items: T[]
): Array<{ project_id: string; project_name: string; items: T[] }> {
  const map = new Map<string, { project_id: string; project_name: string; items: T[] }>();
  for (const it of items) {
    let g = map.get(it.project_id);
    if (!g) {
      g = { project_id: it.project_id, project_name: it.project_name, items: [] };
      map.set(it.project_id, g);
    }
    g.items.push(it);
  }
  return [...map.values()];
}
