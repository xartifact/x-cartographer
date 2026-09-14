'use client';

/**
 * 故事地图状态管理
 */

import { create } from 'zustand';
import { Priority, Position, StoryStatus } from '@/types';
import { UserActivity, UserStory } from '@/types';
import type { StoryMapFilter, StoryMapConfig, ZoomLevel } from '../types';

interface StoryMapState {
  /** 当前选中的故事 */
  selectedStory: UserStory | null;
  /** 筛选条件 */
  filter: StoryMapFilter;
  /** 缩放级别 */
  zoom: ZoomLevel;
  /** 视口位置 */
  position: Position;
  /** 故事地图配置 */
  config: StoryMapConfig;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;

  // Actions
  /** 设置选中的故事 */
  setSelectedStory: (story: UserStory | null) => void;
  /** 设置优先级筛选 */
  setPriorityFilter: (priorities: Priority[]) => void;
  /** 设置活动筛选 */
  setActivityFilter: (activityIds: string[]) => void;
  /** 设置状态筛选 */
  setStatusFilter: (statuses: StoryStatus[]) => void;
  /** 设置发布筛选 */
  setMilestoneFilter: (milestoneIds: string[]) => void;
  /** 设置搜索关键词 */
  setSearchQuery: (query: string) => void;
  /** 重置筛选条件 */
  resetFilter: () => void;
  /** 设置缩放级别 */
  setZoom: (zoom: ZoomLevel) => void;
  /** 缩放增加 */
  zoomIn: () => void;
  /** 缩放减少 */
  zoomOut: () => void;
  /** 重置缩放 */
  resetZoom: () => void;
  /** 设置视口位置 */
  setPosition: (position: Position) => void;
  /** 设置配置 */
  setConfig: (config: Partial<StoryMapConfig>) => void;
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;
  /** 设置错误信息 */
  setError: (error: string | null) => void;
}

const defaultFilter: StoryMapFilter = {
  priorities: [],
  activityIds: [],
  statuses: [],
  milestoneIds: [],
  searchQuery: '',
};

const defaultConfig: StoryMapConfig = {
  columnWidth: 280,
  rowHeight: 120,
  nodePadding: 12,
  showGrid: true,
  showActivityHeader: true,
};

const defaultPosition: Position = { x: 0, y: 0 };

export const useStoryMapStore = create<StoryMapState>((set, get) => ({
  selectedStory: null,
  filter: defaultFilter,
  zoom: 1,
  position: defaultPosition,
  config: defaultConfig,
  isLoading: false,
  error: null,

  setSelectedStory: (story) => {
    set({ selectedStory: story });
  },

  setPriorityFilter: (priorities) => {
    set((state) => ({
      filter: { ...state.filter, priorities },
    }));
  },

  setActivityFilter: (activityIds) => {
    set((state) => ({
      filter: { ...state.filter, activityIds },
    }));
  },

  setStatusFilter: (statuses) => {
    set((state) => ({
      filter: { ...state.filter, statuses },
    }));
  },

  setMilestoneFilter: (milestoneIds) => {
    set((state) => ({
      filter: { ...state.filter, milestoneIds },
    }));
  },

  setSearchQuery: (searchQuery) => {
    set((state) => ({
      filter: { ...state.filter, searchQuery },
    }));
  },

  resetFilter: () => {
    set({ filter: defaultFilter });
  },

  setZoom: (zoom) => {
    set({ zoom });
  },

  zoomIn: () => {
    const { zoom } = get();
    const zoomLevels: ZoomLevel[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = zoomLevels.indexOf(zoom);
    if (currentIndex < zoomLevels.length - 1) {
      set({ zoom: zoomLevels[currentIndex + 1] });
    }
  },

  zoomOut: () => {
    const { zoom } = get();
    const zoomLevels: ZoomLevel[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = zoomLevels.indexOf(zoom);
    if (currentIndex > 0) {
      set({ zoom: zoomLevels[currentIndex - 1] });
    }
  },

  resetZoom: () => {
    set({ zoom: 1, position: defaultPosition });
  },

  setPosition: (position) => {
    set({ position });
  },

  setConfig: (newConfig) => {
    set((state) => ({
      config: { ...state.config, ...newConfig },
    }));
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  setError: (error) => {
    set({ error });
  },
}));

/**
 * 根据筛选条件过滤故事
 *
 * 当没有任何筛选条件激活时，保留所有活动（包括空活动），
 * 以便用户能在画布上看到新创建的空活动。
 * 当有筛选条件激活时，隐藏没有匹配故事的活动。
 */
export function filterStories(
  activities: UserActivity[],
  filter: StoryMapFilter
): UserActivity[] {
  const hasActiveFilter =
    filter.priorities.length > 0 ||
    filter.activityIds.length > 0 ||
    filter.statuses.length > 0 ||
    filter.milestoneIds.length > 0 ||
    filter.searchQuery.length > 0;

  return activities
    .map((activity) => {
      // 活动筛选：如果指定了活动 ID，且该活动不在列表中，整个活动跳过
      if (
        filter.activityIds.length > 0 &&
        !filter.activityIds.includes(activity.id)
      ) {
        return null;
      }

      const filteredStories = (activity.stories || []).filter((story) => {
        // 优先级筛选
        if (
          filter.priorities.length > 0 &&
          !filter.priorities.includes(story.priority)
        ) {
          return false;
        }

        // 状态筛选
        if (filter.statuses.length > 0) {
          const storyStatus = story.status || 'backlog';
          if (!filter.statuses.includes(storyStatus)) {
            return false;
          }
        }

        // 发布筛选：'unplanned' 表示未排期故事
        if (filter.milestoneIds.length > 0) {
          const storyMilestone = story.milestone_id ?? null;
          const wantsUnplanned = filter.milestoneIds.includes('unplanned');
          if (wantsUnplanned) {
            // 选择未排期时，排除已排期故事
            if (storyMilestone !== null) return false;
          } else if (storyMilestone === null || !filter.milestoneIds.includes(storyMilestone)) {
            return false;
          }
        }
        // 搜索关键词筛选
        if (filter.searchQuery) {
          const query = filter.searchQuery.toLowerCase();
          return (
            story.title.toLowerCase().includes(query) ||
            story.description.toLowerCase().includes(query) ||
            story.id.toLowerCase().includes(query) ||
            story.tags.some((tag) => tag.toLowerCase().includes(query))
          );
        }

        return true;
      });

      return {
        ...activity,
        stories: filteredStories,
      };
    })
    .filter((activity): activity is UserActivity => {
      if (activity === null) return false;
      // 无筛选条件时：保留所有活动（包括空活动）
      // 有筛选条件时：仅保留有匹配故事的活动
      if (!hasActiveFilter) return true;
      return activity.stories.length > 0;
    });
}

/**
 * 按优先级分组故事
 */
export function groupStoriesByPriority(stories: UserStory[]): {
  high: UserStory[];
  medium: UserStory[];
  low: UserStory[];
} {
  return {
    high: stories.filter((s) => s.priority === Priority.HIGH),
    medium: stories.filter((s) => s.priority === Priority.MEDIUM),
    low: stories.filter((s) => s.priority === Priority.LOW),
  };
}
