import { describe, it, expect } from 'vitest';
import { useTaskStatusStore } from '../stores/task-status-store';
import type { TaskStatus, StoryStatus } from '@x-cartographer/shared';
import { TaskStatus as TaskStatusEnum } from '@x-cartographer/shared';

/** 重置 store 到初始状态 */
function resetStore() {
  useTaskStatusStore.setState({
    selectedTaskIds: [],
    selectedStoryIds: [],
    statusFilter: { statuses: [], entityType: 'all' },
  });
}

describe('task-status-store: 任务选择', () => {
  it('toggleTaskSelection 选中/取消任务', () => {
    resetStore();
    const store = useTaskStatusStore;

    store.getState().toggleTaskSelection('t1');
    expect(store.getState().selectedTaskIds).toEqual(['t1']);

    store.getState().toggleTaskSelection('t2');
    expect(store.getState().selectedTaskIds).toEqual(['t1', 't2']);

    store.getState().toggleTaskSelection('t1');
    expect(store.getState().selectedTaskIds).toEqual(['t2']);
  });

  it('selectAllTasks 全选（替换选中集合）', () => {
    resetStore();
    const store = useTaskStatusStore;

    store.getState().selectAllTasks(['t1', 't2']);
    expect(store.getState().selectedTaskIds).toEqual(['t1', 't2']);
  });

  it('selectAllTasks 后 selectTask 追加不重复', () => {
    resetStore();
    const store = useTaskStatusStore;

    store.getState().selectAllTasks(['t1', 't2']);
    store.getState().selectTask('t1');
    store.getState().selectTask('t3');
    expect(store.getState().selectedTaskIds).toEqual(['t1', 't2', 't3']);
  });

  it('clearAllSelections 清空所有选择', () => {
    resetStore();
    const store = useTaskStatusStore;

    store.getState().selectAllTasks(['t1', 't2']);
    store.getState().selectStory('s1');
    store.getState().clearAllSelections();

    expect(store.getState().selectedTaskIds).toEqual([]);
    expect(store.getState().selectedStoryIds).toEqual([]);
  });
});

describe('task-status-store: 筛选', () => {
  it('matchesFilter 按状态数组命中', () => {
    resetStore();
    const store = useTaskStatusStore;

    store.getState().setStatusFilter({
      statuses: [TaskStatusEnum.TODO as TaskStatus, 'in_progress' as StoryStatus],
      entityType: 'all',
    });

    expect(
      store.getState().matchesFilter('task', TaskStatusEnum.TODO)
    ).toBe(true);
    expect(
      store.getState().matchesFilter('task', TaskStatusEnum.IN_PROGRESS)
    ).toBe(true);
    expect(store.getState().matchesFilter('task', TaskStatusEnum.DONE)).toBe(
      false
    );
  });

  it('clearFilter 清空筛选后全部命中', () => {
    resetStore();
    const store = useTaskStatusStore;

    store.getState().setStatusFilter({
      statuses: [TaskStatusEnum.DONE],
      entityType: 'task',
    });
    expect(
      store.getState().matchesFilter('task', TaskStatusEnum.TODO)
    ).toBe(false);

    store.getState().clearFilter();
    expect(
      store.getState().matchesFilter('task', TaskStatusEnum.TODO)
    ).toBe(true);
    expect(store.getState().matchesFilter('task', TaskStatusEnum.DONE)).toBe(
      true
    );
  });

  it('setStatusFilter 合并更新而非覆盖', () => {
    resetStore();
    const store = useTaskStatusStore;

    store.getState().setStatusFilter({
      entityType: 'task',
    });
    store.getState().setStatusFilter({
      statuses: [TaskStatusEnum.IN_PROGRESS],
    });

    const filter = store.getState().statusFilter;
    expect(filter.entityType).toBe('task');
    expect(filter.statuses).toEqual([TaskStatusEnum.IN_PROGRESS]);
  });
});

describe('task-status-store: 持久化状态结构', () => {
  it('初始形状完整', () => {
    resetStore();
    const state = useTaskStatusStore.getState();
    expect(Array.isArray(state.selectedTaskIds)).toBe(true);
    expect(Array.isArray(state.selectedStoryIds)).toBe(true);
    expect(typeof state.matchesFilter).toBe('function');
    expect(typeof state.clearAllSelections).toBe('function');
  });
});