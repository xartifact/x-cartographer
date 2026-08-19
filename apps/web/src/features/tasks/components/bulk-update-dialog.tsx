/**
 * 批量状态更新确认弹窗组件
 */

'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@x-cartographer/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@x-cartographer/ui';
import { StatusBadge } from './status-badge';
import type { TaskStatus, StoryStatus } from '@/types';

export interface BulkUpdateConfirmDialogProps {
  /** 是否显示 */
  open: boolean;

  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;

  /** 选中的实体数量 */
  selectedCount: {
    tasks: number;
    stories: number;
  };

  /** 当前状态 */
  currentStatus: TaskStatus | StoryStatus;

  /** 目标状态 */
  targetStatus: TaskStatus | StoryStatus;

  /** 是否为任务 */
  isTask?: boolean;

  /** 确认回调 */
  onConfirm: () => void;

  /** 取消回调 */
  onCancel?: () => void;

  /** 变更原因 */
  reason?: string;

  /** 原因变更回调 */
  onReasonChange?: (reason: string) => void;
}

/**
 * 批量状态更新确认弹窗
 */
export function BulkUpdateConfirmDialog({
  open,
  onOpenChange,
  selectedCount,
  currentStatus,
  targetStatus,
  isTask = true,
  onConfirm,
  onCancel,
  reason,
  onReasonChange,
}: BulkUpdateConfirmDialogProps) {
  const totalCount = selectedCount.tasks + selectedCount.stories;

  // 没有选中任何内容
  if (totalCount === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>批量更新状态</DialogTitle>
            <DialogDescription>
              请先选择要更新的任务或用户故事
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center text-muted-foreground">
            未选中任何内容
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            批量更新状态
          </DialogTitle>
          <DialogDescription>
            确认将选中的 {totalCount} 个项目更新到新状态
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 状态变更预览 */}
          <div className="flex items-center justify-center gap-4 py-4">
            <StatusBadge
              status={currentStatus}
              isTask={isTask}
              size="lg"
            />
            <span className="text-muted-foreground">→</span>
            <StatusBadge
              status={targetStatus}
              isTask={isTask}
              size="lg"
            />
          </div>

          {/* 选中内容统计 */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm font-medium mb-2">将要更新的项目</div>
            <div className="flex gap-4 text-sm">
              {selectedCount.tasks > 0 && (
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{selectedCount.tasks}</span>
                  <span className="text-muted-foreground">个任务</span>
                </div>
              )}
              {selectedCount.stories > 0 && (
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{selectedCount.stories}</span>
                  <span className="text-muted-foreground">个用户故事</span>
                </div>
              )}
            </div>
          </div>

          {/* 变更原因 */}
          {onReasonChange && (
            <div className="space-y-2">
              <label className="text-sm font-medium">变更原因（可选）</label>
              <input
                type="text"
                value={reason || ''}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="输入变更原因..."
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-md',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20',
                  'placeholder:text-muted-foreground'
                )}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            确认更新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 批量操作工具栏
 */
export function BulkActionToolbar({
  selectedCount,
  onStatusChange,
  onClearSelection,
  className,
}: {
  selectedCount: { tasks: number; stories: number };
  onStatusChange: (status: TaskStatus | StoryStatus) => void;
  onClearSelection: () => void;
  className?: string;
}) {
  const totalCount = selectedCount.tasks + selectedCount.stories;

  if (totalCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-2 bg-primary/5 border rounded-lg',
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold">{totalCount}</span>
        <span>项已选中</span>
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          清除选择
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">设为:</span>
        <BulkStatusButtons
          selectedCount={selectedCount}
          onStatusChange={onStatusChange}
        />
      </div>
    </div>
  );
}

/**
 * 批量操作状态按钮组
 */
function BulkStatusButtons({
  selectedCount,
  onStatusChange,
}: {
  selectedCount: { tasks: number; stories: number };
  onStatusChange: (status: TaskStatus | StoryStatus) => void;
}) {
  const isTask = selectedCount.tasks > 0 && selectedCount.stories === 0;
  const options = isTask
    ? [
        { value: 'todo', label: '待开始', color: 'slate' },
        { value: 'in_progress', label: '进行中', color: 'blue' },
        { value: 'done', label: '已完成', color: 'green' },
      ]
    : [
        { value: 'todo', label: '待开始', color: 'slate' },
        { value: 'in_progress', label: '进行中', color: 'blue' },
        { value: 'done', label: '已完成', color: 'green' },
      ];

  return (
    <div className="flex gap-1">
      {options.map((option) => (
        <Button
          key={option.value}
          variant="outline"
          size="sm"
          onClick={() => onStatusChange(option.value as TaskStatus | StoryStatus)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}