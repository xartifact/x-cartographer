import { describe, it, expect } from 'vitest';
import {
  Priority as PriorityEnum,
  TaskType as TaskTypeEnum,
  TaskPriority as TaskPriorityEnum,
  TaskStatus as TaskStatusEnum,
  type Project,
} from '@x-cartographer/shared';
import {
  flattenProjects,
  filterByQuery,
  groupByProject,
  isActiveStoryStatus,
  isActiveTaskStatus,
} from '../active-workbench';

function makeProject(id: string, name: string): Project {
  return {
    id,
    name,
    metadata: { tech_stack: [], version: '1.0.0', tags: [] },
    settings: { auto_save: true, display_preferences: { show_priority_colors: true, show_estimation: true, default_view: 'map' } },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    user_journeys: [
      {
        id: `${id}-journey-1`,
        name: '核心旅程',
        description: '',
        persona: 'PM',
        project_id: id,
        order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        stories: [
          {
            id: `${id}-US-01`,
            title: '导入故事',
            description: '',
            priority: PriorityEnum.HIGH,
            estimation: 5,
            acceptance_criteria: [],
            tags: [],
            journey_id: `${id}-journey-1`,
            order: 0,
            status: TaskStatusEnum.IN_PROGRESS,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            tasks: [
              { id: `${id}-T-1`, title: '写解析器', description: '', type: TaskTypeEnum.TECHNICAL_TASK, priority: TaskPriorityEnum.P1, estimation: 3, status: TaskStatusEnum.IN_PROGRESS, dependencies: [], story_id: `${id}-US-01`, tags: [], created_at: '', updated_at: '' },
              { id: `${id}-T-2`, title: '写 UI', description: '', type: TaskTypeEnum.TECHNICAL_TASK, priority: TaskPriorityEnum.P2, estimation: 2, status: TaskStatusEnum.BACKLOG, dependencies: [], story_id: `${id}-US-01`, tags: [], created_at: '', updated_at: '' },
            ],
          },
          {
            id: `${id}-US-02`,
            title: '待启动故事',
            description: '',
            priority: PriorityEnum.LOW,
            estimation: 2,
            acceptance_criteria: [],
            tags: [],
            journey_id: `${id}-journey-1`,
            order: 1,
            status: TaskStatusEnum.BACKLOG,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            tasks: [
              { id: `${id}-T-3`, title: '调研', description: '', type: TaskTypeEnum.SPIKE, priority: TaskPriorityEnum.P3, estimation: 1, status: TaskStatusEnum.BACKLOG, dependencies: [], story_id: `${id}-US-02`, tags: [], created_at: '', updated_at: '' },
            ],
          },
          {
            id: `${id}-US-03`,
            title: '已完成故事',
            description: '',
            priority: PriorityEnum.MEDIUM,
            estimation: 1,
            acceptance_criteria: [],
            tags: [],
            journey_id: `${id}-journey-1`,
            order: 2,
            status: TaskStatusEnum.DONE,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            tasks: [
              { id: `${id}-T-4`, title: '已完任务', description: '', type: TaskTypeEnum.BUG_FIX, priority: TaskPriorityEnum.P0, estimation: 1, status: TaskStatusEnum.DONE, dependencies: [], story_id: `${id}-US-03`, tags: [], created_at: '', updated_at: '' },
            ],
          },
        ],
      },
    ],
  };
}

describe('active-workbench', () => {
  it('状态判定符合"活跃"定义', () => {
    expect(isActiveStoryStatus('todo')).toBe(true);
    expect(isActiveStoryStatus(TaskStatusEnum.IN_PROGRESS)).toBe(true);
    expect(isActiveStoryStatus(TaskStatusEnum.BACKLOG)).toBe(false);
    expect(isActiveStoryStatus(TaskStatusEnum.DONE)).toBe(false);

    expect(isActiveTaskStatus('todo')).toBe(true);
    expect(isActiveTaskStatus(TaskStatusEnum.IN_PROGRESS)).toBe(true);
    expect(isActiveTaskStatus('in_review')).toBe(true);
    expect(isActiveTaskStatus('testing')).toBe(true);
    expect(isActiveTaskStatus(TaskStatusEnum.BACKLOG)).toBe(false);
    expect(isActiveTaskStatus(TaskStatusEnum.DONE)).toBe(false);
  });

  it('flattenProjects 聚合活跃需求/任务并区分待办池', () => {
    const data = flattenProjects([makeProject('P-1', 'App'), makeProject('P-2', 'Web')]);

    // 活跃需求：每个项目 1 个 in_progress 故事
    expect(data.activeStories).toHaveLength(2);
    expect(data.activeStories.map((s) => s.project_name).sort()).toEqual(['App', 'Web']);

    // 活跃任务：每项目 1 个 in_progress 任务
    expect(data.activeTasks).toHaveLength(2);
    expect(data.activeTasks[0].story_title).toBe('导入故事');

    // 待办池：每项目 1 个 backlog 故事 + 2 个 backlog 任务（T-2, T-3）
    expect(data.backlogStories).toHaveLength(2);
    expect(data.backlogTasks).toHaveLength(4);

    // done / cancelled 不进入任何集合
    const allTitles = [...data.activeStories, ...data.backlogStories].map((s) => s.title);
    expect(allTitles).not.toContain('已完成故事');

    // 活跃故事下统计其活跃任务数
    expect(data.activeStories[0].active_task_count).toBe(1);

    // 项目数
    expect(data.projectCount).toBe(2);
  });

  it('flattenProjects 容忍空/不完整树', () => {
    expect(flattenProjects(undefined).activeStories).toEqual([]);
    expect(flattenProjects([]).activeTasks).toEqual([]);
    expect(flattenProjects(null).projectCount).toBe(0);
    // 无 user_journeys 的项目
    const p = makeProject('P-x', 'X');
    p.user_journeys = [];
    expect(flattenProjects([p]).projectCount).toBe(1);
  });

  it('filterByQuery 按标题过滤', () => {
    const items = [{ title: '导入故事' }, { title: '导出报表' }];
    expect(filterByQuery(items, '导入')).toHaveLength(1);
    expect(filterByQuery(items, '')).toHaveLength(2);
    expect(filterByQuery(items, '不存在')).toHaveLength(0);
  });

  it('groupByProject 按项目分组且保持顺序', () => {
    const data = flattenProjects([makeProject('P-1', 'App'), makeProject('P-2', 'Web')]);
    const groups = groupByProject(data.activeStories);
    expect(groups).toHaveLength(2);
    expect(groups[0].project_name).toBe('App');
    expect(groups.map((g) => g.items.length)).toEqual([1, 1]);
  });
});
