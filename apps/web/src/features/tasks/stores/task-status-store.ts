/**
 * 任务状态 UI 管理 Store (Zustand) — 轻量版
 * 仅管理纯 UI 状态：选择、筛选
 * 状态变更历史通过 lib/api hooks (useStatusHistory/useCreateStatusChange) 获取
 * 状态变更操作通过 REST mutation hooks 完成
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskStatus, StoryStatus } from '@x-cartographer/shared';

export {
  TASK_STATUS_OPTIONS,
  STORY_STATUS_OPTIONS,
} from '../components/status-badge';

export interface StatusFilter {
  statuses: (TaskStatus | StoryStatus)[];
  entityType: 'task' | 'story' | 'all';
  inProgressOnly?: boolean;
  completedOnly?: boolean;
}

export interface TaskStatusUIState {
  selectedTaskIds: string[];
  selectedStoryIds: string[];
  statusFilter: StatusFilter;

  selectTask: (taskId: string) => void;
  deselectTask: (taskId: string) => void;
  toggleTaskSelection: (taskId: string) => void;
  selectAllTasks: (taskIds: string[]) => void;
  deselectAllTasks: () => void;
  selectStory: (storyId: string) => void;
  deselectStory: (storyId: string) => void;
  toggleStorySelection: (storyId: string) => void;
  selectAllStories: (storyIds: string[]) => void;
  deselectAllStories: () => void;
  clearAllSelections: () => void;
  setStatusFilter: (filter: Partial<StatusFilter>) => void;
  clearFilter: () => void;
  matchesFilter: (entityType: 'task' | 'story', status: TaskStatus | StoryStatus) => boolean;
}

export const useTaskStatusStore = create<TaskStatusUIState>()(
  persist(
    (set, get) => ({
      selectedTaskIds: [],
      selectedStoryIds: [],
      statusFilter: {
        statuses: [],
        entityType: 'all',
        inProgressOnly: false,
        completedOnly: false,
      },

      selectTask: (taskId: string) => {
        set((state) => ({
          selectedTaskIds: state.selectedTaskIds.includes(taskId)
            ? state.selectedTaskIds
            : [...state.selectedTaskIds, taskId],
        }));
      },

      deselectTask: (taskId: string) => {
        set((state) => ({
          selectedTaskIds: state.selectedTaskIds.filter((id) => id !== taskId),
        }));
      },

      toggleTaskSelection: (taskId: string) => {
        set((state) => ({
          selectedTaskIds: state.selectedTaskIds.includes(taskId)
            ? state.selectedTaskIds.filter((id) => id !== taskId)
            : [...state.selectedTaskIds, taskId],
        }));
      },

      selectAllTasks: (taskIds: string[]) => {
        set({ selectedTaskIds: taskIds });
      },

      deselectAllTasks: () => {
        set({ selectedTaskIds: [] });
      },

      selectStory: (storyId: string) => {
        set((state) => ({
          selectedStoryIds: state.selectedStoryIds.includes(storyId)
            ? state.selectedStoryIds
            : [...state.selectedStoryIds, storyId],
        }));
      },

      deselectStory: (storyId: string) => {
        set((state) => ({
          selectedStoryIds: state.selectedStoryIds.filter((id) => id !== storyId),
        }));
      },

      toggleStorySelection: (storyId: string) => {
        set((state) => ({
          selectedStoryIds: state.selectedStoryIds.includes(storyId)
            ? state.selectedStoryIds.filter((id) => id !== storyId)
            : [...state.selectedStoryIds, storyId],
        }));
      },

      selectAllStories: (storyIds: string[]) => {
        set({ selectedStoryIds: storyIds });
      },

      deselectAllStories: () => {
        set({ selectedStoryIds: [] });
      },

      clearAllSelections: () => {
        set({
          selectedTaskIds: [],
          selectedStoryIds: [],
        });
      },

      setStatusFilter: (filter: Partial<StatusFilter>) => {
        set((state) => ({
          statusFilter: { ...state.statusFilter, ...filter },
        }));
      },

      clearFilter: () => {
        set({
          statusFilter: {
            statuses: [],
            entityType: 'all',
            inProgressOnly: false,
            completedOnly: false,
          },
        });
      },

      matchesFilter: (entityType: 'task' | 'story', status: TaskStatus | StoryStatus) => {
        const { statuses, entityType: filterEntityType, inProgressOnly, completedOnly } = get().statusFilter;
        if (filterEntityType !== 'all' && filterEntityType !== entityType) return false;
        if (statuses.length > 0 && !statuses.includes(status)) return false;
        if (inProgressOnly) {
          const isInProgress = entityType === 'task' ? status.includes('progress') : status === 'in_progress';
          if (!isInProgress) return false;
        }
        if (completedOnly && status !== 'done') return false;
        return true;
      },
    }),
    {
      name: 'task-status-store',
      partialize: (state) => ({
        selectedTaskIds: state.selectedTaskIds,
        selectedStoryIds: state.selectedStoryIds,
        statusFilter: state.statusFilter,
      }),
    }
  )
);

export const selectSelectedTaskIds = (state: TaskStatusUIState) => state.selectedTaskIds;
export const selectSelectedStoryIds = (state: TaskStatusUIState) => state.selectedStoryIds;
export const selectStatusFilter = (state: TaskStatusUIState) => state.statusFilter;
export const selectHasSelection = (state: TaskStatusUIState) =>
  state.selectedTaskIds.length > 0 || state.selectedStoryIds.length > 0;
export const selectSelectionCount = (state: TaskStatusUIState) => ({
  tasks: state.selectedTaskIds.length,
  stories: state.selectedStoryIds.length,
  total: state.selectedTaskIds.length + state.selectedStoryIds.length,
});
