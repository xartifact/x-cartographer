import { describe, it, expect } from 'vitest';
import {
  serializeTaskListToMarkdown,
  serializeKanbanMarkdown,
  groupTasksByStatus,
} from '../serialize';
import type { Project, Task } from '@x-cartographer/shared';
import {
  TaskStatus,
  TaskPriority,
  TaskType,
  Priority,
} from '@x-cartographer/shared';

/** 构造一个带任务的项目夹具 */
function makeProject(): Project {
  const now = new Date().toISOString();
  const taskA: Task = {
    id: 'TASK-001',
    title: '实现故事地图',
    description: 'ReactFlow 画布',
    type: TaskType.TECHNICAL_TASK,
    priority: TaskPriority.P0,
    estimation: 5,
    status: TaskStatus.IN_PROGRESS,
    dependencies: [],
    story_id: 'US-001',
    project_id: 'P1',
    tags: ['ui'],
    created_at: now,
    updated_at: now,
  };
  const taskB: Task = {
    id: 'TASK-002',
    title: '实现任务列表',
    description: '',
    type: TaskType.USER_STORY,
    priority: TaskPriority.P1,
    estimation: 3,
    status: TaskStatus.TODO,
    dependencies: ['TASK-001'],
    story_id: 'US-002',
    project_id: 'P1',
    tags: ['ui', 'data'],
    created_at: now,
    updated_at: now,
  };
  return {
    id: 'P1',
    name: '测试项目',
    description: '夹具项目',
    metadata: { tags: [], version: '1.0.0', tech_stack: [] },
    settings: {
      auto_save: true,
      display_preferences: {
        default_view: 'map',
        show_estimation: true,
        show_priority_colors: true,
      },
    },
    created_at: now,
    updated_at: now,
    user_journeys: [
      {
        id: 'UJ-1',
        name: '规划',
        description: '',
        persona: '',
        project_id: 'P1',
        priority: 'high',
        order: 0,
        created_at: now,
        updated_at: now,
        stories: [
          {
            id: 'US-001',
            title: '[US-001] 故事地图',
            description: '',
            priority: Priority.HIGH,
            estimation: 8,
            acceptance_criteria: [],
            tags: [],
            journey_id: 'UJ-1',
            order: 0,
            status: 'in_progress',
            created_at: now,
            updated_at: now,
            tasks: [taskA],
          },
          {
            id: 'US-002',
            title: '[US-002] 任务列表',
            description: '',
            priority: Priority.MEDIUM,
            estimation: 4,
            acceptance_criteria: [],
            tags: [],
            journey_id: 'UJ-1',
            order: 1,
            status: 'backlog',
            created_at: now,
            updated_at: now,
            tasks: [taskB],
          },
        ],
      },
    ],
  };
}

describe('serializeTaskListToMarkdown', () => {
  it('空列表返回空字符串', () => {
    expect(serializeTaskListToMarkdown([])).toBe('');
  });

  it('序列化任务为「- id: title」列表', () => {
    const project = makeProject();
    const tasks = project.user_journeys[0].stories[0].tasks ?? [];
    const md = serializeTaskListToMarkdown(tasks);
    expect(md).toContain('- TASK-001: 实现故事地图');
  });
});

describe('groupTasksByStatus', () => {
  it('按状态分组任务', () => {
    const project = makeProject();
    const tasks = [
      ...(project.user_journeys[0].stories[0].tasks ?? []),
      ...(project.user_journeys[0].stories[1].tasks ?? []),
    ];
    const groups = groupTasksByStatus(tasks);
    expect(groups[TaskStatus.IN_PROGRESS]).toHaveLength(1);
    expect(groups[TaskStatus.TODO]).toHaveLength(1);
    expect(groups[TaskStatus.DONE] ?? []).toHaveLength(0);
  });
});

describe('serializeKanbanMarkdown', () => {
  it('输出包含看板标题与项目名', () => {
    const md = serializeKanbanMarkdown(makeProject());
    expect(md).toContain('# 测试项目 - Kanban 看板');
    expect(md).toContain('**总任务数**');
  });

  it('按状态分列且包含任务详情（优先级/估算/依赖/故事/标签）', () => {
    const md = serializeKanbanMarkdown(makeProject());
    // 任务标题
    expect(md).toContain('TASK-001: 实现故事地图');
    expect(md).toContain('TASK-002: 实现任务列表');
    // 详情字段
    expect(md).toContain('P0');
    expect(md).toContain('5h');
    expect(md).toContain('依赖');
    expect(md).toContain('US-001');
    expect(md).toContain('ui');
  });

  it('任务状态分组到对应列', () => {
    const md = serializeKanbanMarkdown(makeProject());
    // in_progress 任务出现在 In Progress 部分
    const inProgressIndex = md.indexOf('## 🔄 In Progress');
    const todoIndex = md.indexOf('## 📝 To Do');
    expect(inProgressIndex).toBeGreaterThan(-1);
    expect(todoIndex).toBeGreaterThan(-1);
    expect(md.indexOf('TASK-001: 实现故事地图')).toBeGreaterThan(inProgressIndex);
    expect(md.indexOf('TASK-002: 实现任务列表')).toBeGreaterThan(todoIndex);
  });
});