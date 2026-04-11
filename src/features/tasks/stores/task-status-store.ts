/**
 * 任务状态管理 Store (Zustand)
 *
 * 管理任务和用户故事的状态更新、状态变更历史记录
 * 状态变更历史持久化到数据库
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { TaskStatus, StoryStatus, StatusChangeRecord, Timestamp } from '@/types';
import {
  getAllStatusChanges,
  createStatusChange,
  createManyStatusChanges,
  deleteStatusChange,
  deleteEntityStatusHistory,
  deleteAllStatusHistory,
} from '@/app/actions/status.actions';

// Re-export status options from components for convenience
export { TASK_STATUS_OPTIONS, STORY_STATUS_OPTIONS } from '../components/status-badge';

/**
 * 状态更新参数
 */
export interface StatusUpdateParams {
  entityId: string;
  entityType: 'task' | 'story';
  newStatus: TaskStatus | StoryStatus;
  reason?: string;
  updateChildren?: boolean;
  childrenStatusMap?: {
    [parentStatus: string]: TaskStatus;
  };
}

/**
 * 批量状态更新参数
 */
export interface BulkStatusUpdateParams {
  entityIds: string[];
  entityType: 'task' | 'story';
  newStatus: TaskStatus | StoryStatus;
  reason?: string;
}

/**
 * 筛选条件
 */
export interface StatusFilter {
  statuses: (TaskStatus | StoryStatus)[];
  entityType: 'task' | 'story' | 'all';
  inProgressOnly?: boolean;
  completedOnly?: boolean;
}

/**
 * 状态管理状态接口
 */
export interface TaskStatusState {
  statusHistory: StatusChangeRecord[];
  selectedTaskIds: string[];
  selectedStoryIds: string[];
  statusFilter: StatusFilter;

  loadStatusHistory: () => Promise<void>;
  updateStatus: (params: StatusUpdateParams) => StatusChangeRecord | null;
  bulkUpdateStatus: (params: BulkStatusUpdateParams) => StatusChangeRecord[];
  undoStatusChange: (historyId: string) => boolean;
  getEntityHistory: (entityId: string) => StatusChangeRecord[];
  clearEntityHistory: (entityId: string) => void;
  clearAllHistory: () => void;

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

function getCurrentTimestamp(): Timestamp {
  return new Date().toISOString();
}

/**
 * 异步持久化状态变更到数据库（fire-and-forget）
 */
function persistRecord(record: StatusChangeRecord): void {
  createStatusChange(record).catch((err) => {
    console.error('Failed to persist status change:', err);
  });
}

function persistRecords(records: StatusChangeRecord[]): void {
  createManyStatusChanges(records).catch((err) => {
    console.error('Failed to persist status changes:', err);
  });
}

/**
 * 创建任务状态管理 Store
 */
export const useTaskStatusStore = create<TaskStatusState>()(
  persist(
    (set, get) => ({
      statusHistory: [],
      selectedTaskIds: [],
      selectedStoryIds: [],
      statusFilter: {
        statuses: [],
        entityType: 'all',
        inProgressOnly: false,
        completedOnly: false,
      },

      loadStatusHistory: async () => {
        try {
          const records = await getAllStatusChanges();
          set({ statusHistory: records });
        } catch {
          // DB 未初始化时静默失败，使用内存中的数据
        }
      },

      updateStatus: (params: StatusUpdateParams) => {
        const { entityId, entityType, newStatus, reason } = params;

        const entityHistory = get().statusHistory.filter(
          (h) => h.entity_id === entityId && h.entity_type === entityType
        );
        const lastHistory = entityHistory[entityHistory.length - 1];
        const previousStatus = lastHistory ? lastHistory.new_status : null;

        if (previousStatus === newStatus) {
          return null;
        }

        const record: StatusChangeRecord = {
          id: uuidv4(),
          entity_id: entityId,
          entity_type: entityType,
          previous_status: previousStatus || newStatus,
          new_status: newStatus,
          reason,
          changed_at: getCurrentTimestamp(),
        };

        set((state) => ({
          statusHistory: [...state.statusHistory, record],
        }));

        persistRecord(record);
        return record;
      },

      bulkUpdateStatus: (params: BulkStatusUpdateParams) => {
        const { entityIds, entityType, newStatus, reason } = params;

        const records: StatusChangeRecord[] = entityIds.map((entityId) => ({
          id: uuidv4(),
          entity_id: entityId,
          entity_type: entityType,
          previous_status: newStatus,
          new_status: newStatus,
          reason,
          changed_at: getCurrentTimestamp(),
        }));

        set((state) => ({
          statusHistory: [...state.statusHistory, ...records],
        }));

        persistRecords(records);
        return records;
      },

      undoStatusChange: (historyId: string) => {
        const history = get().statusHistory;
        const recordIndex = history.findIndex((h) => h.id === historyId);

        if (recordIndex === -1) {
          return false;
        }

        const record = history[recordIndex];

        const undoRecord: StatusChangeRecord = {
          id: uuidv4(),
          entity_id: record.entity_id,
          entity_type: record.entity_type,
          previous_status: record.new_status,
          new_status: record.previous_status,
          reason: `撤销: ${record.reason || '未记录原因'}`,
          changed_at: getCurrentTimestamp(),
        };

        set((state) => ({
          statusHistory: [
            ...state.statusHistory.slice(0, recordIndex),
            ...state.statusHistory.slice(recordIndex + 1),
            undoRecord,
          ],
        }));

        deleteStatusChange(historyId).catch(() => {});
        persistRecord(undoRecord);
        return true;
      },

      getEntityHistory: (entityId: string) => {
        return get().statusHistory.filter((h) => h.entity_id === entityId);
      },

      clearEntityHistory: (entityId: string) => {
        set((state) => ({
          statusHistory: state.statusHistory.filter((h) => h.entity_id !== entityId),
        }));
        deleteEntityStatusHistory(entityId).catch(() => {});
      },

      clearAllHistory: () => {
        set({ statusHistory: [] });
        deleteAllStatusHistory().catch(() => {});
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
          statusFilter: {
            ...state.statusFilter,
            ...filter,
          },
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
        const { statuses, entityType: filterEntityType, inProgressOnly, completedOnly } =
          get().statusFilter;

        if (filterEntityType !== 'all' && filterEntityType !== entityType) {
          return false;
        }

        if (statuses.length > 0 && !statuses.includes(status)) {
          return false;
        }

        if (inProgressOnly) {
          const config = entityType === 'task'
            ? { isInProgress: status.includes('progress') }
            : { isInProgress: status === 'in_progress' };
          if (!config.isInProgress) {
            return false;
          }
        }

        if (completedOnly) {
          if (status !== 'done') {
            return false;
          }
        }

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

/**
 * 选择器函数
 */
export const selectStatusHistory = (state: TaskStatusState) => state.statusHistory;
export const selectSelectedTaskIds = (state: TaskStatusState) => state.selectedTaskIds;
export const selectSelectedStoryIds = (state: TaskStatusState) => state.selectedStoryIds;
export const selectStatusFilter = (state: TaskStatusState) => state.statusFilter;
export const selectHasSelection = (state: TaskStatusState) =>
  state.selectedTaskIds.length > 0 || state.selectedStoryIds.length > 0;
export const selectSelectionCount = (state: TaskStatusState) => ({
  tasks: state.selectedTaskIds.length,
  stories: state.selectedStoryIds.length,
  total: state.selectedTaskIds.length + state.selectedStoryIds.length,
});

/**
 * 状态统计 Hook 结果类型
 */
export interface StatusStats {
  counts: Record<string, number>;
  total: number;
  completed: number;
  inProgress: number;
  completionRate: number;
  inProgressRate: number;
}
