/**
 * 任务状态管理 Store (Zustand)
 *
 * 管理任务和用户故事的状态更新、状态变更历史记录
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { TaskStatus, StoryStatus, StatusChangeRecord, Timestamp } from '@/types';

// Re-export status options from components for convenience
export { TASK_STATUS_OPTIONS, STORY_STATUS_OPTIONS } from '../components/status-badge';

/**
 * 状态更新参数
 */
export interface StatusUpdateParams {
  /** 实体 ID */
  entityId: string;

  /** 实体类型：'task' | 'story' */
  entityType: 'task' | 'story';

  /** 新状态 */
  newStatus: TaskStatus | StoryStatus;

  /** 变更原因（可选） */
  reason?: string;

  /** 是否同时更新子任务状态 */
  updateChildren?: boolean;

  /** 子任务状态映射 */
  childrenStatusMap?: {
    [parentStatus: string]: TaskStatus;
  };
}

/**
 * 批量状态更新参数
 */
export interface BulkStatusUpdateParams {
  /** 实体 ID 列表 */
  entityIds: string[];

  /** 实体类型 */
  entityType: 'task' | 'story';

  /** 新状态 */
  newStatus: TaskStatus | StoryStatus;

  /** 变更原因（可选） */
  reason?: string;
}

/**
 * 筛选条件
 */
export interface StatusFilter {
  /** 状态列表（空数组表示不过滤） */
  statuses: (TaskStatus | StoryStatus)[];

  /** 实体类型 */
  entityType: 'task' | 'story' | 'all';

  /** 是否只显示进行中的 */
  inProgressOnly?: boolean;

  /** 是否只显示已完成的 */
  completedOnly?: boolean;
}

/**
 * 状态管理状态接口
 */
export interface TaskStatusState {
  // ========== 状态变更历史 ==========
  /** 状态变更历史记录 */
  statusHistory: StatusChangeRecord[];

  // ========== 选中状态 ==========
  /** 选中的任务 ID */
  selectedTaskIds: string[];

  /** 选中的故事 ID */
  selectedStoryIds: string[];

  // ========== 筛选状态 ==========
  /** 当前筛选条件 */
  statusFilter: StatusFilter;

  // ========== 操作 ==========

  /**
   * 更新单个实体状态
   */
  updateStatus: (params: StatusUpdateParams) => StatusChangeRecord | null;

  /**
   * 批量更新状态
   */
  bulkUpdateStatus: (params: BulkStatusUpdateParams) => StatusChangeRecord[];

  /**
   * 撤销状态变更
   */
  undoStatusChange: (historyId: string) => boolean;

  /**
   * 获取实体的状态变更历史
   */
  getEntityHistory: (entityId: string) => StatusChangeRecord[];

  /**
   * 清除实体的状态变更历史
   */
  clearEntityHistory: (entityId: string) => void;

  /**
   * 清除所有历史记录
   */
  clearAllHistory: () => void;

  // ========== 选择操作 ==========

  /**
   * 选中单个任务
   */
  selectTask: (taskId: string) => void;

  /**
   * 取消选中单个任务
   */
  deselectTask: (taskId: string) => void;

  /**
   * 切换任务选中状态
   */
  toggleTaskSelection: (taskId: string) => void;

  /**
   * 选中所有任务
   */
  selectAllTasks: (taskIds: string[]) => void;

  /**
   * 取消选中所有任务
   */
  deselectAllTasks: () => void;

  /**
   * 选中单个故事
   */
  selectStory: (storyId: string) => void;

  /**
   * 取消选中单个故事
   */
  deselectStory: (storyId: string) => void;

  /**
   * 切换故事选中状态
   */
  toggleStorySelection: (storyId: string) => void;

  /**
   * 选中所有故事
   */
  selectAllStories: (storyIds: string[]) => void;

  /**
   * 取消选中所有故事
   */
  deselectAllStories: () => void;

  /**
   * 清除所有选择
   */
  clearAllSelections: () => void;

  // ========== 筛选操作 ==========

  /**
   * 设置状态筛选
   */
  setStatusFilter: (filter: Partial<StatusFilter>) => void;

  /**
   * 清除筛选
   */
  clearFilter: () => void;

  /**
   * 检查实体是否匹配当前筛选
   */
  matchesFilter: (entityType: 'task' | 'story', status: TaskStatus | StoryStatus) => boolean;
}

/**
 * 获取当前时间戳
 */
function getCurrentTimestamp(): Timestamp {
  return new Date().toISOString();
}

/**
 * 创建任务状态管理 Store
 */
export const useTaskStatusStore = create<TaskStatusState>()(
  persist(
    (set, get) => ({
      // ========== 初始状态 ==========
      statusHistory: [],
      selectedTaskIds: [],
      selectedStoryIds: [],
      statusFilter: {
        statuses: [],
        entityType: 'all',
        inProgressOnly: false,
        completedOnly: false,
      },

      // ========== 状态更新操作 ==========

      updateStatus: (params: StatusUpdateParams) => {
        const { entityId, entityType, newStatus, reason } = params;

        // 查找最近一次该实体的状态变更
        const entityHistory = get().statusHistory.filter(
          (h) => h.entity_id === entityId && h.entity_type === entityType
        );
        const lastHistory = entityHistory[entityHistory.length - 1];

        // 确定之前的状态
        const previousStatus = lastHistory ? lastHistory.new_status : null;

        // 如果状态相同，不创建记录
        if (previousStatus === newStatus) {
          return null;
        }

        // 创建变更记录
        const record: StatusChangeRecord = {
          id: uuidv4(),
          entity_id: entityId,
          entity_type: entityType,
          previous_status: previousStatus || newStatus,
          new_status: newStatus,
          reason,
          changed_at: getCurrentTimestamp(),
        };

        // 添加到历史记录
        set((state) => ({
          statusHistory: [...state.statusHistory, record],
        }));

        return record;
      },

      bulkUpdateStatus: (params: BulkStatusUpdateParams) => {
        const { entityIds, entityType, newStatus, reason } = params;

        // 批量创建变更记录
        const records: StatusChangeRecord[] = entityIds.map((entityId) => ({
          id: uuidv4(),
          entity_id: entityId,
          entity_type: entityType,
          previous_status: newStatus, // 简化处理，批量更新时假设之前状态不同
          new_status: newStatus,
          reason,
          changed_at: getCurrentTimestamp(),
        }));

        // 批量添加到历史记录
        set((state) => ({
          statusHistory: [...state.statusHistory, ...records],
        }));

        return records;
      },

      undoStatusChange: (historyId: string) => {
        const history = get().statusHistory;
        const recordIndex = history.findIndex((h) => h.id === historyId);

        if (recordIndex === -1) {
          return false;
        }

        const record = history[recordIndex];

        // 创建撤销记录
        const undoRecord: StatusChangeRecord = {
          id: uuidv4(),
          entity_id: record.entity_id,
          entity_type: record.entity_type,
          previous_status: record.new_status,
          new_status: record.previous_status,
          reason: `撤销: ${record.reason || '未记录原因'}`,
          changed_at: getCurrentTimestamp(),
        };

        // 移除原记录，添加撤销记录
        set((state) => ({
          statusHistory: [
            ...state.statusHistory.slice(0, recordIndex),
            ...state.statusHistory.slice(recordIndex + 1),
            undoRecord,
          ],
        }));

        return true;
      },

      getEntityHistory: (entityId: string) => {
        return get().statusHistory.filter((h) => h.entity_id === entityId);
      },

      clearEntityHistory: (entityId: string) => {
        set((state) => ({
          statusHistory: state.statusHistory.filter((h) => h.entity_id !== entityId),
        }));
      },

      clearAllHistory: () => {
        set({ statusHistory: [] });
      },

      // ========== 选择操作 ==========

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

      // ========== 筛选操作 ==========

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

        // 检查实体类型
        if (filterEntityType !== 'all' && filterEntityType !== entityType) {
          return false;
        }

        // 检查状态列表
        if (statuses.length > 0 && !statuses.includes(status)) {
          return false;
        }

        // 检查进行中筛选
        if (inProgressOnly) {
          const config = entityType === 'task'
            ? { isInProgress: status.includes('progress') }
            : { isInProgress: status === 'in_progress' };
          if (!config.isInProgress) {
            return false;
          }
        }

        // 检查已完成筛选
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
        // 只持久化选择和筛选状态
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

// 获取状态历史记录
export const selectStatusHistory = (state: TaskStatusState) => state.statusHistory;

// 获取选中的任务 ID
export const selectSelectedTaskIds = (state: TaskStatusState) => state.selectedTaskIds;

// 获取选中的故事 ID
export const selectSelectedStoryIds = (state: TaskStatusState) => state.selectedStoryIds;

// 获取当前筛选条件
export const selectStatusFilter = (state: TaskStatusState) => state.statusFilter;

// 获取是否有选中项
export const selectHasSelection = (state: TaskStatusState) =>
  state.selectedTaskIds.length > 0 || state.selectedStoryIds.length > 0;

// 获取选中数量
export const selectSelectionCount = (state: TaskStatusState) => ({
  tasks: state.selectedTaskIds.length,
  stories: state.selectedStoryIds.length,
  total: state.selectedTaskIds.length + state.selectedStoryIds.length,
});

/**
 * 状态统计 Hook 结果类型
 */
export interface StatusStats {
  /** 各状态的数量统计 */
  counts: Record<string, number>;

  /** 总数 */
  total: number;

  /** 完成数 */
  completed: number;

  /** 进行中数 */
  inProgress: number;

  /** 完成率 */
  completionRate: number;

  /** 进行中率 */
  inProgressRate: number;
}