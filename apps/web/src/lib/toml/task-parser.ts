/**
 * 任务 TOML 解析器
 * 用于解析开发任务跟踪文件
 */

export interface TomlTask {
  id: string;
  title: string;
  description: string;
  type: 'user_story' | 'technical_task' | 'bug_fix' | 'spike';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  estimation: number;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'testing' | 'done' | 'cancelled';
  dependencies: string[];
  related_story: string;
  tags: string[];
}

export interface TomlTaskMetadata {
  project_name: string;
  version: string;
  created_at: string;
  board_name: string;
}

export interface TomlTaskConfig {
  states: string[];
  wip_limits: Record<string, number>;
}

export interface TomlTaskFile {
  metadata: TomlTaskMetadata;
  config: TomlTaskConfig;
  tasks: TomlTask[];
}

/**
 * 任务类型映射
 */
export const taskTypeLabels: Record<string, string> = {
  user_story: '用户故事',
  technical_task: '技术任务',
  bug_fix: 'Bug 修复',
  spike: '技术探索',
};

/**
 * 任务优先级映射
 */
export const priorityLabels: Record<string, { label: string; color: string }> = {
  P0: { label: 'P0', color: 'bg-red-500' },
  P1: { label: 'P1', color: 'bg-orange-500' },
  P2: { label: 'P2', color: 'bg-blue-500' },
  P3: { label: 'P3', color: 'bg-gray-500' },
};

/**
 * 任务状态映射
 */
export const statusLabels: Record<string, { label: string; color: string }> = {
  backlog: { label: '待定', color: 'bg-gray-500' },
  todo: { label: '待办', color: 'bg-slate-500' },
  in_progress: { label: '进行中', color: 'bg-blue-500' },
  in_review: { label: '审核中', color: 'bg-purple-500' },
  testing: { label: '测试中', color: 'bg-yellow-500' },
  done: { label: '已完成', color: 'bg-green-500' },
  cancelled: { label: '已取消', color: 'bg-red-500' },
};

/**
 * 解析任务 TOML 文件内容
 */
export async function parseTaskTomlFile(content: string): Promise<TomlTaskFile> {
  const toml = await import('toml');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = toml.parse(content) as any;

  // 解析任务
  const tasks: TomlTask[] = (data.tasks || []).map((task: TomlTask) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type || 'technical_task',
    priority: task.priority || 'P2',
    estimation: task.estimation || 0,
    status: task.status || 'backlog',
    dependencies: task.dependencies || [],
    related_story: task.related_story || '',
    tags: task.tags || [],
  }));

  return {
    metadata: {
      project_name: data.metadata?.project_name || 'Unknown Project',
      version: data.metadata?.version || '1.0',
      created_at: data.metadata?.created_at || new Date().toISOString().split('T')[0],
      board_name: data.metadata?.board_name || 'Development Board',
    },
    config: {
      states: data.config?.states || ['backlog', 'todo', 'in_progress', 'done'],
      wip_limits: data.config?.wip_limits || {},
    },
    tasks,
  };
}

/**
 * 转换为应用内部任务格式
 */
export interface AppTask {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  estimation: number;
  status: string;
  dependencies: string[];
  relatedStory: string;
  tags: string[];
}

export function toAppTasks(tomlTasks: TomlTaskFile): AppTask[] {
  return tomlTasks.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    priority: task.priority,
    estimation: task.estimation,
    status: task.status,
    dependencies: task.dependencies,
    relatedStory: task.related_story,
    tags: task.tags,
  }));
}

/**
 * 获取统计信息
 */
export function getTaskStats(tomlTasks: TomlTaskFile) {
  const tasks = tomlTasks.tasks;
  return {
    total: tasks.length,
    byStatus: Object.keys(statusLabels).reduce((acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status).length;
      return acc;
    }, {} as Record<string, number>),
    byPriority: Object.keys(priorityLabels).reduce((acc, priority) => {
      acc[priority] = tasks.filter((t) => t.priority === priority).length;
      return acc;
    }, {} as Record<string, number>),
    byType: Object.keys(taskTypeLabels).reduce((acc, type) => {
      acc[type] = tasks.filter((t) => t.type === type).length;
      return acc;
    }, {} as Record<string, number>),
    totalEstimation: tasks.reduce((sum, t) => sum + (t.estimation || 0), 0),
  };
}