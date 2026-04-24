/**
 * 故事地图类型定义
 */

import { Priority, Position, StoryStatus } from '@/types';
import { UserJourney } from '@/types/user-journey';
import { UserStory } from '@/types/user-story';

/**
 * 故事地图筛选条件
 */
export interface StoryMapFilter {
  /** 按优先级筛选 */
  priorities: Priority[];
  /** 按旅程筛选 */
  journeyIds: string[];
  /** 按状态筛选 */
  statuses: StoryStatus[];
  /** 搜索关键词 */
  searchQuery: string;
}

/**
 * 旅程列数据
 */
export interface JourneyColumnData {
  journey: UserJourney;
  stories: UserStory[];
  storyCount: number;
}

/**
 * 故事节点数据
 */
export interface StoryNodeData {
  story: UserStory;
  journeyName: string;
  isSelected: boolean;
  onSelect?: (story: UserStory) => void;
}

/**
 * 旅程头节点数据
 */
export interface JourneyHeaderNodeData {
  journey: UserJourney;
  storyCount: number;
}

/**
 * 缩放级别
 */
export type ZoomLevel = 0.25 | 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

/**
 * 画布视图状态
 */
export interface CanvasViewState {
  /** 缩放级别 */
  zoom: ZoomLevel;
  /** 视口位置 */
  position: Position;
  /** 是否自动居中 */
  autoCenter: boolean;
}

/**
 * 故事地图配置
 */
export interface StoryMapConfig {
  /** 列宽度 */
  columnWidth: number;
  /** 行高度 */
  rowHeight: number;
  /** 节点间距 */
  nodePadding: number;
  /** 是否显示网格 */
  showGrid: boolean;
  /** 是否显示旅程头 */
  showJourneyHeader: boolean;
}

/**
 * 故事地图状态
 */
export interface StoryMapState {
  /** 当前选中的故事 */
  selectedStory: UserStory | null;
  /** 筛选条件 */
  filter: StoryMapFilter;
  /** 画布视图状态 */
  viewState: CanvasViewState;
  /** 故事地图配置 */
  config: StoryMapConfig;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
}