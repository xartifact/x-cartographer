'use client';

/**
 * 故事地图状态管理
 */

import { create } from 'zustand';
import { Priority, Position, StoryStatus } from '@/types';
import { UserJourney, UserStory } from '@/types';
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
  /** 设置旅程筛选 */
  setJourneyFilter: (journeyIds: string[]) => void;
  /** 设置状态筛选 */
  setStatusFilter: (statuses: StoryStatus[]) => void;
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
  journeyIds: [],
  statuses: [],
  searchQuery: '',
};

const defaultConfig: StoryMapConfig = {
  columnWidth: 280,
  rowHeight: 120,
  nodePadding: 12,
  showGrid: true,
  showJourneyHeader: true,
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

  setJourneyFilter: (journeyIds) => {
    set((state) => ({
      filter: { ...state.filter, journeyIds },
    }));
  },

  setStatusFilter: (statuses) => {
    set((state) => ({
      filter: { ...state.filter, statuses },
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
 */
export function filterStories(
  journeys: UserJourney[],
  filter: StoryMapFilter
): UserJourney[] {
  return journeys
    .map((journey) => {
      const filteredStories = (journey.stories || []).filter((story) => {
        // 优先级筛选
        if (
          filter.priorities.length > 0 &&
          !filter.priorities.includes(story.priority)
        ) {
          return false;
        }

        // 旅程筛选
        if (
          filter.journeyIds.length > 0 &&
          !filter.journeyIds.includes(journey.id)
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
        ...journey,
        stories: filteredStories,
      };
    })
    .filter((journey) => journey.stories.length > 0);
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