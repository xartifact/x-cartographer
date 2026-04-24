/**
 * 视图切换组件
 *
 * 支持预设状态视图的快速切换
 */

'use client';

import * as React from 'react';
import { Check, LayoutGrid, List, Kanban, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox as _Checkbox } from '@/components/ui/checkbox';

export type ViewType = 'list' | 'board' | 'timeline' | 'kanban';

export interface ViewSwitcherProps {
  /** 当前视图 */
  currentView: ViewType;

  /** 视图变更回调 */
  onViewChange: (view: ViewType) => void;

  /** 可用视图列表 */
  availableViews?: ViewType[];

  /** 禁用状态 */
  disabled?: boolean;

  /** 自定义类名 */
  className?: string;
}

/**
 * 视图图标映射
 */
const VIEW_ICONS: Record<ViewType, React.ElementType> = {
  list: List,
  board: LayoutGrid,
  timeline: Calendar,
  kanban: Kanban,
};

/**
 * 视图名称映射
 */
const VIEW_LABELS: Record<ViewType, string> = {
  list: '列表视图',
  board: '看板视图',
  timeline: '时间线',
  kanban: 'Kanban',
};

/**
 * 预设视图
 */
export interface PresetView {
  id: string;
  name: string;
  description?: string;
  filters: {
    statuses: string[];
    inProgressOnly?: boolean;
    completedOnly?: boolean;
  };
}

export interface ViewSwitcherWithPresetsProps {
  /** 当前视图 */
  currentView: ViewType;

  /** 视图变更回调 */
  onViewChange: (view: ViewType) => void;

  /** 预设视图列表 */
  presetViews: PresetView[];

  /** 当前活动的预设 */
  activePreset: string | null;

  /** 预设变更回调 */
  onPresetChange: (presetId: string | null) => void;

  /** 禁用状态 */
  disabled?: boolean;

  /** 自定义类名 */
  className?: string;
}

/**
 * 视图切换组件
 */
export function ViewSwitcher({
  currentView,
  onViewChange,
  availableViews = ['list', 'board', 'kanban', 'timeline'],
  disabled = false,
  className,
}: ViewSwitcherProps) {
  const _Icon = VIEW_ICONS[currentView] || List;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {availableViews.map((view) => {
        const ViewIcon = VIEW_ICONS[view] || List;
        const isActive = currentView === view;

        return (
          <Button
            key={view}
            variant={isActive ? 'default' : 'ghost'}
            size="icon"
            disabled={disabled}
            onClick={() => onViewChange(view)}
            className={cn('h-8 w-8', isActive && 'bg-primary')}
            title={VIEW_LABELS[view]}
          >
            <ViewIcon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}

/**
 * 带预设的视图切换器
 */
export function ViewSwitcherWithPresets({
  currentView,
  onViewChange,
  presetViews,
  activePreset,
  onPresetChange,
  disabled = false,
  className,
}: ViewSwitcherWithPresetsProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const _Icon = VIEW_ICONS[currentView] || List;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* 视图切换按钮 */}
      <ViewSwitcher
        currentView={currentView}
        onViewChange={onViewChange}
        disabled={disabled}
      />

      <div className="w-px h-4 bg-border" />

      {/* 预设视图选择器 */}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <span>
              {activePreset
                ? presetViews.find((p) => p.id === activePreset)?.name || '自定义'
                : '预设视图'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>选择视图预设</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* 默认视图 */}
          <DropdownMenuItem
            onClick={() => {
              onPresetChange(null);
              setIsOpen(false);
            }}
          >
            <div className="flex items-center gap-2">
              {!activePreset && <Check className="h-4 w-4" />}
              <span className="font-medium">全部</span>
            </div>
            <span className="ml-auto text-xs text-muted-foreground">显示所有项目</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* 预设视图列表 */}
          {presetViews.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => {
                onPresetChange(preset.id);
                setIsOpen(false);
              }}
            >
              <div className="flex items-center gap-2 flex-1">
                {activePreset === preset.id && <Check className="h-4 w-4" />}
                <span className={cn('font-medium', activePreset === preset.id && 'ml-0')}>
                  {preset.name}
                </span>
              </div>
              {preset.description && (
                <span className="ml-auto text-xs text-muted-foreground truncate max-w-[120px]">
                  {preset.description}
                </span>
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          {/* 自定义筛选提示 */}
          {activePreset && (
            <DropdownMenuItem disabled>
              <span className="text-xs text-muted-foreground">
                当前筛选: {presetViews.find((p) => p.id === activePreset)?.filters.statuses.length || 0} 个状态
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * 预设视图配置面板
 */
export interface PresetConfigPanelProps {
  /** 预设视图列表 */
  presetViews: PresetView[];

  /** 添加预设回调 */
  onAddPreset: (preset: PresetView) => void;

  /** 更新预设回调 */
  onUpdatePreset: (presetId: string, preset: Partial<PresetView>) => void;

  /** 删除预设回调 */
  onDeletePreset: (presetId: string) => void;

  /** 自定义类名 */
  className?: string;
}

export function PresetConfigPanel({
  presetViews,
  onAddPreset,
  onUpdatePreset,
  onDeletePreset,
  className,
}: PresetConfigPanelProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [newPresetName, setNewPresetName] = React.useState('');

  const handleAddPreset = () => {
    if (!newPresetName.trim()) return;

    const newPreset: PresetView = {
      id: `preset-${Date.now()}`,
      name: newPresetName.trim(),
      filters: {
        statuses: [],
      },
    };

    onAddPreset(newPreset);
    setNewPresetName('');
  };

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-sm font-medium">视图预设配置</h3>

      {/* 新建预设 */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          placeholder="新预设名称..."
          className={cn(
            'flex-1 px-3 py-1.5 text-sm border rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-primary/20'
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddPreset();
          }}
        />
        <Button size="sm" onClick={handleAddPreset} disabled={!newPresetName.trim()}>
          添加
        </Button>
      </div>

      {/* 预设列表 */}
      <div className="space-y-2">
        {presetViews.map((preset) => (
          <div
            key={preset.id}
            className="flex items-center justify-between p-3 rounded-lg border"
          >
            <div className="flex-1">
              {editingId === preset.id ? (
                <input
                  type="text"
                  value={preset.name}
                  onChange={(e) => onUpdatePreset(preset.id, { name: e.target.value })}
                  className="px-2 py-1 text-sm border rounded"
                  autoFocus
                  onBlur={() => setEditingId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setEditingId(null);
                  }}
                />
              ) : (
                <span className="font-medium">{preset.name}</span>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                状态: {preset.filters.statuses.join(', ') || '全部'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditingId(preset.id)}
              >
                编辑
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => onDeletePreset(preset.id)}
              >
                删除
              </Button>
            </div>
          </div>
        ))}

        {presetViews.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            暂无预设配置
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * 默认预设视图
 */
export const DEFAULT_PRESET_VIEWS: PresetView[] = [
  {
    id: 'all',
    name: '全部',
    description: '显示所有项目',
    filters: {
      statuses: [],
    },
  },
  {
    id: 'in-progress',
    name: '进行中',
    description: '只显示进行中的项目',
    filters: {
      statuses: ['in_progress', 'in_review', 'testing'],
      inProgressOnly: true,
    },
  },
  {
    id: 'todo',
    name: '待处理',
    description: '待开始的任务',
    filters: {
      statuses: ['backlog', 'todo'],
    },
  },
  {
    id: 'completed',
    name: '已完成',
    description: '只显示已完成的项目',
    filters: {
      statuses: ['done'],
      completedOnly: true,
    },
  },
];