import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStatusStore } from '../stores/task-status-store';
import { DEFAULT_PRESETS } from '../components/preset-manager';
import { TaskStatus } from '@x-cartographer/shared';
import type { StoryStatus } from '@x-cartographer/shared';

/** 预设条件 → tasks-page handleApplyPreset 的映射（statusFilter 数组 + 搜索词） */
function presetToStatusFilter(conditions: (typeof DEFAULT_PRESETS)[number]['conditions']) {
  return {
    statusFilter: conditions.taskStatuses ? [...conditions.taskStatuses] : [],
    searchQuery: conditions.searchQuery ?? '',
  };
}

function resetStore() {
  useTaskStatusStore.setState({
    selectedTaskIds: [],
    selectedStoryIds: [],
    statusFilter: { statuses: [], entityType: 'all' },
  });
}

beforeEach(resetStore);

describe('DEFAULT_PRESETS 完整性', () => {
  it('内置五个默认预设且 id 唯一', () => {
    const ids = DEFAULT_PRESETS.map((p) => p.id);
    expect(ids).toEqual(['all', 'in-progress', 'todo', 'completed', 'high-priority']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('「全部」预设为空条件（不过滤任何东西）', () => {
    const all = DEFAULT_PRESETS.find((p) => p.id === 'all')!;
    const { statusFilter, searchQuery } = presetToStatusFilter(all.conditions);
    expect(statusFilter).toEqual([]);
    expect(searchQuery).toBe('');
  });

  it('「已完成」预设任务侧覆盖 done、故事侧覆盖 accepted（两套状态机的收口语义）', () => {
    const completed = DEFAULT_PRESETS.find((p) => p.id === 'completed')!;
    expect(completed.conditions.taskStatuses).toContain(TaskStatus.DONE);
    expect(completed.conditions.storyStatuses).toContain('accepted');
    expect(completed.conditions.taskStatuses).not.toContain(TaskStatus.CANCELLED);
    expect(completed.conditions.storyStatuses).not.toContain('cancelled');
  });

  it('「进行中」预设覆盖 in_review/testing（进行中不止 in_progress 一个态）', () => {
    const inProgress = DEFAULT_PRESETS.find((p) => p.id === 'in-progress')!;
    expect(inProgress.conditions.taskStatuses).toEqual(
      expect.arrayContaining([TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.TESTING])
    );
  });
});

describe('预设条件经 matchesFilter 的过滤行为（store × preset 集成）', () => {
  it('应用「进行中」预设后：任务侧 in_progress 命中、done 不命中；故事侧 in_progress 命中', () => {
    const inProgress = DEFAULT_PRESETS.find((p) => p.id === 'in-progress')!;
    const { statusFilter } = presetToStatusFilter(inProgress.conditions);
    const store = useTaskStatusStore;
    store.getState().setStatusFilter({ statuses: statusFilter, entityType: 'all' });

    expect(store.getState().matchesFilter('task', TaskStatus.IN_PROGRESS)).toBe(true);
    expect(store.getState().matchesFilter('task', TaskStatus.IN_REVIEW)).toBe(true);
    expect(store.getState().matchesFilter('task', TaskStatus.DONE)).toBe(false);
    expect(store.getState().matchesFilter('story', 'in_progress' as StoryStatus)).toBe(true);
    expect(store.getState().matchesFilter('story', 'accepted' as StoryStatus)).toBe(false);
  });

  it('应用「已完成」预设后：任务页仅映射任务状态——done 命中、进行中不命中（storyStatuses 不参与任务页筛选，tasks-page handleApplyPreset 只取 taskStatuses）', () => {
    const completed = DEFAULT_PRESETS.find((p) => p.id === 'completed')!;
    const { statusFilter } = presetToStatusFilter(completed.conditions);
    const store = useTaskStatusStore;
    store.getState().setStatusFilter({ statuses: statusFilter, entityType: 'all' });

    expect(statusFilter).toEqual([TaskStatus.DONE]);
    expect(store.getState().matchesFilter('task', TaskStatus.DONE)).toBe(true);
    expect(store.getState().matchesFilter('task', TaskStatus.TODO)).toBe(false);
  });

  it('空条件预设（全部）不过滤任何状态', () => {
    const all = DEFAULT_PRESETS.find((p) => p.id === 'all')!;
    const { statusFilter } = presetToStatusFilter(all.conditions);
    const store = useTaskStatusStore;
    store.getState().setStatusFilter({ statuses: statusFilter, entityType: 'all' });

    expect(store.getState().matchesFilter('task', TaskStatus.BACKLOG)).toBe(true);
    expect(store.getState().matchesFilter('story', 'cancelled' as StoryStatus)).toBe(true);
  });
});

describe('matchesFilter 快捷开关语义（此前未覆盖）', () => {
  it('inProgressOnly: 任务侧含 in_review/testing（状态串含 progress 才算）——记录现行为', () => {
    const store = useTaskStatusStore;
    store.getState().setStatusFilter({ inProgressOnly: true });

    expect(store.getState().matchesFilter('task', TaskStatus.IN_PROGRESS)).toBe(true);
    expect(store.getState().matchesFilter('task', TaskStatus.DONE)).toBe(false);
    // 现实现用 status.includes('progress')：in_review/testing 不含 'progress' → 不命中
    expect(store.getState().matchesFilter('task', TaskStatus.IN_REVIEW)).toBe(false);
    expect(store.getState().matchesFilter('story', 'in_progress' as StoryStatus)).toBe(true);
    expect(store.getState().matchesFilter('story', 'accepted' as StoryStatus)).toBe(false);
  });

  it('completedOnly: 仅 done（任务）与 accepted（故事）命中', () => {
    const store = useTaskStatusStore;
    store.getState().setStatusFilter({ completedOnly: true });

    expect(store.getState().matchesFilter('task', TaskStatus.DONE)).toBe(true);
    expect(store.getState().matchesFilter('story', 'accepted' as StoryStatus)).toBe(true);
    expect(store.getState().matchesFilter('task', TaskStatus.TODO)).toBe(false);
    expect(store.getState().matchesFilter('story', 'backlog' as StoryStatus)).toBe(false);
  });

  it('entityType 不匹配的实体被排除（task 筛选不影响 story 判定为 false）', () => {
    const store = useTaskStatusStore;
    store.getState().setStatusFilter({ entityType: 'task' });

    expect(store.getState().matchesFilter('story', TaskStatus.DONE)).toBe(false);
    expect(store.getState().matchesFilter('task', TaskStatus.DONE)).toBe(true);
  });
});
