/**
 * 筛选预设管理器
 *
 * 支持筛选条件的保存、加载和预设管理
 */

'use client';

import * as React from 'react';
import {
  Star,
  Save,
  Trash2,
  Download,
  Upload,
  Settings,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createLogger } from '@/lib/logger';
import { Button } from '@xpm/ui';
import { Input } from '@xpm/ui';
import { Badge } from '@xpm/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@xpm/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@xpm/ui';
import { Separator } from '@xpm/ui';
import { TaskStatus, Priority } from '@/types';
import type { StoryStatus } from '@/types';

const log = createLogger('presetManager');

/**
 * 预设存储键名
 */
const PRESETS_STORAGE_KEY = 'filter-presets';

/**
 * 筛选条件类型
 */
export interface FilterPreset {
  /** 预设 ID */
  id: string;

  /** 预设名称 */
  name: string;

  /** 预设描述 */
  description?: string;

  /** 是否为默认预设 */
  isDefault?: boolean;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;

  /** 筛选条件 */
  conditions: FilterConditions;
}

/**
 * 筛选条件
 */
export interface FilterConditions {
  /** 任务状态列表 */
  taskStatuses?: TaskStatus[];

  /** 故事状态列表 */
  storyStatuses?: StoryStatus[];

  /** 优先级列表 */
  priorities?: Priority[];

  /** 搜索关键词 */
  searchQuery?: string;

  /** 旅程 ID 列表 */
  journeyIds?: string[];

  /** 标签列表 */
  tags?: string[];
}

/**
 * 预设管理器 Props
 */
export interface PresetManagerProps {
  /** 当前筛选条件 */
  currentConditions: FilterConditions;

  /** 预设变更回调 */
  onApplyPreset: (conditions: FilterConditions) => void;

  /** 预设列表 */
  presets?: FilterPreset[];

  /** 预设变更回调（用于添加、更新、删除） */
  onPresetsChange?: (presets: FilterPreset[]) => void;

  /** 是否为任务筛选 */
  isTask?: boolean;

  /** 自定义类名 */
  className?: string;
}

/**
 * 默认预设列表
 */
export const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'all',
    name: '全部',
    description: '显示所有项目',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    conditions: {},
  },
  {
    id: 'in-progress',
    name: '进行中',
    description: '只显示进行中的项目',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    conditions: {
      taskStatuses: [
        TaskStatus.IN_PROGRESS,
        TaskStatus.IN_REVIEW,
        TaskStatus.TESTING,
      ],
      storyStatuses: ['in_progress' as StoryStatus],
    },
  },
  {
    id: 'todo',
    name: '待处理',
    description: '待开始的任务和故事',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    conditions: {
      taskStatuses: [TaskStatus.BACKLOG, TaskStatus.TODO],
      storyStatuses: ['backlog' as StoryStatus, 'todo' as StoryStatus],
    },
  },
  {
    id: 'completed',
    name: '已完成',
    description: '只显示已完成的项目',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    conditions: {
      taskStatuses: [TaskStatus.DONE],
      storyStatuses: ['done' as StoryStatus],
    },
  },
  {
    id: 'high-priority',
    name: '高优先级',
    description: '只显示高优先级的项目',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    conditions: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priorities: [Priority.HIGH, 'P0' as any],
    },
  },
];

/**
 * 筛选预设管理器组件
 */
export function PresetManager({
  currentConditions,
  onApplyPreset,
  presets = DEFAULT_PRESETS,
  onPresetsChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isTask = true,
  className,
}: PresetManagerProps) {
  const [localPresets, setLocalPresets] =
    React.useState<FilterPreset[]>(presets);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [showManageDialog, setShowManageDialog] = React.useState(false);
  const [newPresetName, setNewPresetName] = React.useState('');
  const [editingPreset, setEditingPreset] = React.useState<FilterPreset | null>(
    null
  );

  // 从 localStorage 加载预设
  React.useEffect(() => {
    const savedPresets = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (savedPresets) {
      try {
        const parsed = JSON.parse(savedPresets);
        setLocalPresets(parsed);
      } catch (e) {
        log.error('presets.parse.failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }, []);

  // 保存预设到 localStorage
  const saveToStorage = (newPresets: FilterPreset[]) => {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(newPresets));
    setLocalPresets(newPresets);
    onPresetsChange?.(newPresets);
  };

  // 应用预设
  const applyPreset = (preset: FilterPreset) => {
    onApplyPreset(preset.conditions);
  };

  // 保存当前筛选为新预设
  const saveAsPreset = () => {
    if (!newPresetName.trim()) return;

    const newPreset: FilterPreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName.trim(),
      description: `保存于 ${new Date().toLocaleDateString('zh-CN')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      conditions: { ...currentConditions },
    };

    const newPresets = [...localPresets, newPreset];
    saveToStorage(newPresets);
    setNewPresetName('');
    setShowSaveDialog(false);
  };

  // 删除预设
  const deletePreset = (presetId: string) => {
    const newPresets = localPresets.filter((p) => p.id !== presetId);
    saveToStorage(newPresets);
  };

  // 更新预设
  const updatePreset = (presetId: string, updates: Partial<FilterPreset>) => {
    const newPresets = localPresets.map((p) =>
      p.id === presetId
        ? { ...p, ...updates, updatedAt: new Date().toISOString() }
        : p
    );
    saveToStorage(newPresets);
    setEditingPreset(null);
  };

  // 导出预设
  const exportPresets = () => {
    const data = JSON.stringify(localPresets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filter-presets-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入预设
  const importPresets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          const newPresets = [
            ...localPresets,
            ...imported.filter(
              (p: FilterPreset) => !localPresets.some((lp) => lp.id === p.id)
            ),
          ];
          saveToStorage(newPresets);
        }
      } catch (error) {
        log.error('presets.import.failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // 获取当前匹配的预设
  const getMatchingPreset = (): FilterPreset | null => {
    return (
      localPresets.find((preset) => {
        const cond = preset.conditions;
        return (
          JSON.stringify(cond) === JSON.stringify(currentConditions) ||
          (Object.keys(cond).length === 0 &&
            currentConditions.taskStatuses?.length === 0)
        );
      }) || null
    );
  };

  const matchingPreset = getMatchingPreset();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* 预设选择下拉菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Star className="h-4 w-4" />
            <span>{matchingPreset?.name || '预设'}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            选择筛选预设
          </div>
          <DropdownMenuSeparator />

          {localPresets.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="flex items-center gap-2"
            >
              {preset.isDefault && <Star className="h-3 w-3 text-yellow-500" />}
              <span className="flex-1">{preset.name}</span>
              {preset.description && (
                <span className="max-w-[100px] truncate text-xs text-muted-foreground">
                  {preset.description}
                </span>
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          {/* 保存当前筛选 */}
          <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
            <Save className="mr-2 h-4 w-4" />
            保存当前筛选
          </DropdownMenuItem>

          {/* 管理预设 */}
          <DropdownMenuItem onClick={() => setShowManageDialog(true)}>
            <Settings className="mr-2 h-4 w-4" />
            管理预设
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 显示当前筛选标签 */}
      {matchingPreset && (
        <Badge variant="secondary" className="gap-1">
          <Check className="h-3 w-3" />
          {matchingPreset.name}
        </Badge>
      )}

      {/* 保存预设对话框 */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存筛选预设</DialogTitle>
            <DialogDescription>将当前筛选条件保存为新的预设</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="预设名称..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveAsPreset();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              取消
            </Button>
            <Button onClick={saveAsPreset} disabled={!newPresetName.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 管理预设对话框 */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>管理筛选预设</DialogTitle>
            <DialogDescription>编辑、删除或导入导出预设</DialogDescription>
          </DialogHeader>

          <div className="max-h-[400px] space-y-4 overflow-y-auto py-4">
            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportPresets}>
                <Download className="mr-2 h-4 w-4" />
                导出
              </Button>
              <label>
                <Input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={importPresets}
                />
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    导入
                  </span>
                </Button>
              </label>
            </div>

            <Separator />

            {/* 预设列表 */}
            <div className="space-y-2">
              {localPresets.map((preset) => (
                <div
                  key={preset.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-3',
                    preset.isDefault && 'bg-muted/50'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    {editingPreset?.id === preset.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={preset.name}
                          onChange={(e) =>
                            updatePreset(preset.id, { name: e.target.value })
                          }
                          className="h-8"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingPreset(null)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{preset.name}</span>
                          {preset.isDefault && (
                            <Badge variant="outline" className="text-xs">
                              默认
                            </Badge>
                          )}
                        </div>
                        {preset.description && (
                          <p className="truncate text-xs text-muted-foreground">
                            {preset.description}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  {!preset.isDefault && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingPreset(preset)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deletePreset(preset.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowManageDialog(false)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * 预设选择器（简化版，只显示下拉选择）
 */
export function PresetSelector({
  presets = DEFAULT_PRESETS,
  onSelect,
  className,
}: {
  presets?: FilterPreset[];
  onSelect: (preset: FilterPreset) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Star className="mr-2 h-4 w-4" />
          预设
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {presets.map((preset) => (
          <DropdownMenuItem key={preset.id} onClick={() => onSelect(preset)}>
            {preset.isDefault && (
              <Star className="mr-2 h-3 w-3 text-yellow-500" />
            )}
            <span>{preset.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
