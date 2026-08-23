/**
 * Markdown 序列化工具
 *
 * 用于将项目任务数据导出为 Markdown 格式。
 */

import { TaskStatus } from '@x-cartographer/shared';
import type { Project, Task } from '@x-cartographer/shared';

/**
 * 任务状态顺序（从待规划到已完成）
 */
const KANBAN_STATUS_ORDER: TaskStatus[] = [
  TaskStatus.BACKLOG,
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.TESTING,
  TaskStatus.DONE,
];

/**
 * 任务状态到看板列标题的映射
 */
const KANBAN_STATUS_COLUMNS: Record<
  TaskStatus,
  { emoji: string; label: string; chinese: string }
> = {
  [TaskStatus.BACKLOG]: { emoji: '📋', label: 'Backlog', chinese: '待规划' },
  [TaskStatus.TODO]: { emoji: '📝', label: 'To Do', chinese: '待开始' },
  [TaskStatus.IN_PROGRESS]: { emoji: '🔄', label: 'In Progress', chinese: '进行中' },
  [TaskStatus.IN_REVIEW]: { emoji: '👀', label: 'In Review', chinese: '待评审' },
  [TaskStatus.TESTING]: { emoji: '🧪', label: 'Testing', chinese: '测试中' },
  [TaskStatus.DONE]: { emoji: '✅', label: 'Done', chinese: '已完成' },
  [TaskStatus.CANCELLED]: { emoji: '🚫', label: 'Cancelled', chinese: '已取消' },
};


/**
 * 将任务列表序列化为简单 Markdown 列表
 */
export function serializeTaskListToMarkdown(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '';
  }

  return tasks.map((task) => `- ${task.id}: ${task.title}`).join('\n');
}

/**
 * 将任务按状态分组
 */
export function groupTasksByStatus(
  tasks: Task[]
): Record<TaskStatus, Task[]> {
  const grouped = {} as Record<TaskStatus, Task[]>;

  for (const status of KANBAN_STATUS_ORDER) {
    grouped[status] = [];
  }

  for (const task of tasks) {
    const status = task.status;
    if (grouped[status]) {
      grouped[status].push(task);
    }
  }

  return grouped;
}

/**
 * 收集项目下所有任务，并按故事分组
 */
function collectTasksByStory(
  project: Project
): Record<string, { storyId: string; storyTitle: string; priority: string; tasks: Task[] }> {
  const storyMap: Record<
    string,
    { storyId: string; storyTitle: string; priority: string; tasks: Task[] }
  > = {};

  for (const journey of project.user_journeys ?? []) {
    for (const story of journey.stories ?? []) {
      if (!story.tasks || story.tasks.length === 0) {
        continue;
      }
      if (!storyMap[story.id]) {
        storyMap[story.id] = {
          storyId: story.id,
          storyTitle: story.title,
          priority: story.priority ?? '',
          tasks: [],
        };
      }
      storyMap[story.id].tasks.push(...story.tasks);
    }
  }

  return storyMap;
}

/**
 * 将项目序列化为 Kanban Markdown 格式
 */
export function serializeKanbanMarkdown(project: Project): string {
  const lines: string[] = [];
  const projectName = project.name || '未命名项目';

  // 收集所有任务
  const allTasks: Task[] = [];
  for (const journey of project.user_journeys ?? []) {
    for (const story of journey.stories ?? []) {
      if (story.tasks) {
        allTasks.push(...story.tasks);
      }
    }
  }

  // 头部信息
  lines.push(`# ${projectName} - Kanban 看板`);
  lines.push('');
  lines.push(`**项目**: ${projectName}`);
  lines.push(`**创建日期**: ${formatDate(project.created_at)}`);
  lines.push(`**最后更新**: ${formatDate(project.updated_at)}`);
  lines.push(`**总任务数**: ${allTasks.length}`);
  lines.push(`**WIP 限制**: In Progress (5) | In Review (3) | Testing (2)`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 按状态分组
  const tasksByStatus = groupTasksByStatus(allTasks);

  for (const status of KANBAN_STATUS_ORDER) {
    const tasks = tasksByStatus[status];
    const column = KANBAN_STATUS_COLUMNS[status];

    lines.push(`## ${column.emoji} ${column.label}（${column.chinese}）`);
    lines.push('');

    if (tasks.length === 0) {
      lines.push('> 暂无任务');
      lines.push('');
      continue;
    }

    // 按故事分组
    const storiesMap = collectTasksByStory(project);
    const storiesWithTasks = Object.values(storiesMap).filter((story) =>
      story.tasks.some((task) => task.status === status)
    );

    // 保持原有顺序：按用户旅程和故事顺序
    const orderedStories = orderStoriesByProject(
      project,
      storiesWithTasks,
      status
    );

    for (const story of orderedStories) {
      const storyTasks = story.tasks.filter((task) => task.status === status);
      if (storyTasks.length === 0) {
        continue;
      }

      const priorityLabel = story.priority ? ` (${story.priority})` : '';
      lines.push(`### ${story.storyTitle}${priorityLabel}`);
      lines.push('');

      for (const task of storyTasks) {
        const estimation = task.estimation ? ` \`${task.estimation}h\`` : '';
        lines.push(
          `#### ${task.id}: ${task.title} \`${task.priority}\`${estimation}`
        );
        lines.push(`- **类型**: ${task.type}`);
        lines.push(`- **描述**: ${task.description || '无'}`);
        if (task.dependencies && task.dependencies.length > 0) {
          lines.push(`- **依赖**: ${task.dependencies.join(', ')}`);
        }
        lines.push(`- **关联故事**: ${story.storyId}`);
        if (task.tags && task.tags.length > 0) {
          lines.push(`- **标签**: ${task.tags.join(', ')}`);
        }
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

/**
 * 按项目中的用户旅程和故事顺序排列故事
 */
function orderStoriesByProject(
  project: Project,
  stories: { storyId: string; storyTitle: string; priority: string; tasks: Task[] }[],
  status: TaskStatus
): { storyId: string; storyTitle: string; priority: string; tasks: Task[] }[] {
  const storyOrder: string[] = [];

  for (const journey of project.user_journeys ?? []) {
    for (const story of journey.stories ?? []) {
      if (
        story.tasks?.some((task) => task.status === status) &&
        !storyOrder.includes(story.id)
      ) {
        storyOrder.push(story.id);
      }
    }
  }

  const storyMap = Object.fromEntries(
    stories.map((story) => [story.storyId, story])
  );

  return storyOrder
    .map((id) => storyMap[id])
    .filter(Boolean);
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(timestamp: string | undefined): string {
  if (!timestamp) {
    return '未知';
  }
  try {
    return new Date(timestamp).toISOString().split('T')[0];
  } catch {
    return timestamp;
  }
}
