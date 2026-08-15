/**
 * 状态变更历史记录组件
 *
 * 显示实体的状态变更历史，支持撤销操作
 */

'use client';

import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { RotateCcw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@xpm/ui';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@xpm/ui';
import { Separator } from '@xpm/ui';
import { useStatusHistory, useCreateStatusChange } from '@/lib/api/hooks';
import { StatusBadge } from './status-badge';
import type { StatusChangeRecord, TaskStatus, StoryStatus } from '@/types';

export interface StatusHistoryProps {
  /** 实体 ID */
  entityId: string;

  /** 实体类型 */
  entityType: 'task' | 'story';

  /** 最大显示数量 */
  maxItems?: number;

  /** 是否可折叠 */
  collapsible?: boolean;

  /** 是否显示操作按钮 */
  showActions?: boolean;

  /** 自定义类名 */
  className?: string;
}

/**
 * 单条历史记录项
 */
function HistoryItem({
  record,
  entityType,
  showActions = true,
  onUndo,
}: {
  record: StatusChangeRecord;
  entityType: 'task' | 'story';
  showActions?: boolean;
  onUndo?: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      {/* 时间指示器 */}
      <div className="flex flex-col items-center">
        <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />
        <div className="h-full w-px bg-muted-foreground/20" />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            status={record.previous_status as any}
            isTask={entityType === 'task'}
            variant="outline_gray"
            size="sm"
          />
          <span className="text-muted-foreground text-xs">→</span>
          <StatusBadge
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            status={record.new_status as any}
            isTask={entityType === 'task'}
            size="sm"
          />
        </div>

        <div className="mt-1 text-xs text-muted-foreground">
          {record.reason && (
            <span className="block text-foreground/80">{record.reason}</span>
          )}
          <span className="block">
            {formatDistanceToNow(new Date(record.changed_at), {
              locale: zhCN,
              addSuffix: true,
            })}
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      {showActions && onUndo && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => onUndo(record.id)}
          title="撤销此变更"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

/**
 * 状态变更历史记录组件
 */
export function StatusHistory({
  entityId,
  entityType,
  maxItems = 10,
  collapsible = false,
  showActions = true,
  className,
}: StatusHistoryProps) {
  const { data: historyData = [], isLoading } = useStatusHistory(entityId);
  const createStatusChange = useCreateStatusChange();
  const [isOpen, setIsOpen] = useState(true);

  // 获取历史记录
  const history = historyData;

  const handleUndo = (historyId: string) => {
    // 找到被撤销的那条记录，将状态回滚到其变更前的状态
    const record = history.find((r) => r.id === historyId);
    if (!record) return;
    createStatusChange.mutate({
      entityId: record.entity_id,
      entityType: record.entity_type,
      previousStatus: record.new_status,
      newStatus: record.previous_status,
      reason: `撤销: ${record.reason ?? ''}`,
    });
  };

  if (isLoading) {
    return (
      <div className={cn('text-sm text-muted-foreground py-2', className)}>
        加载中...
      </div>
    );
  }

  // 没有历史记录
  if (history.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground py-2', className)}>
暂无状态变更记录
      </div>
    );
  }

  // 排序：最新的在前
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  );

  // 限制显示数量
  const displayHistory = sortedHistory.slice(0, maxItems);
  const remainingCount = sortedHistory.length - maxItems;


  // 可折叠版本
  if (collapsible) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn('', className)}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex w-full items-center justify-between px-0 hover:px-0"
          >
            <span className="text-sm font-medium">状态历史</span>
            <span className="text-xs text-muted-foreground">({history.length})</span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <span>最新</span>
              <Separator className="flex-1" />
              <span>最早</span>
            </div>
            <div className="space-y-1">
              {displayHistory.map((record) => (
                <HistoryItem
                  key={record.id}
                  record={record}
                  entityType={entityType}
                  showActions={showActions}
                  onUndo={handleUndo}
                />
              ))}
              {remainingCount > 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  还有 {remainingCount} 条更早的记录...
                </p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // 简单列表版本
  return (
    <div className={cn('', className)}>
      <div className="flex items-center gap-2 text-sm font-medium mb-2">
        <span>状态历史</span>
        <span className="text-xs text-muted-foreground">({history.length})</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <span>最新</span>
        <Separator className="flex-1" />
        <span>最早</span>
      </div>

      <div className="space-y-1">
        {displayHistory.map((record) => (
          <HistoryItem
            key={record.id}
            record={record}
            entityType={entityType}
            showActions={showActions}
            onUndo={handleUndo}
          />
        ))}
        {remainingCount > 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            还有 {remainingCount} 条更早的记录...
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * 完整历史记录面板（全屏或模态框中使用）
 */
export function StatusHistoryPanel({
  entityId,
  entityType,
  className,
}: {
  entityId: string;
  entityType: 'task' | 'story';
  className?: string;
}) {
  const { data: historyData = [], isLoading } = useStatusHistory(entityId);
  const createStatusChange = useCreateStatusChange();
  const history = historyData;

  const handleUndo = (historyId: string) => {
    const record = history.find((r) => r.id === historyId);
    if (!record) return;
    createStatusChange.mutate({
      entityId: record.entity_id,
      entityType: record.entity_type,
      previousStatus: record.new_status,
      newStatus: record.previous_status,
      reason: `撤销: ${record.reason ?? ''}`,
    });
  };

  if (isLoading) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        加载中...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        暂无状态变更记录
      </div>
    );
  }

  // 排序：最新的在前
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  );

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">状态变更历史</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // 逐条回滚当前历史（REST API 无批量清除，以撤销方式清理）
            [...sortedHistory].reverse().forEach((record) => {
              createStatusChange.mutate({
                entityId: record.entity_id,
                entityType: record.entity_type,
                previousStatus: record.new_status,
                newStatus: record.previous_status,
                reason: `清除历史: ${record.reason ?? ''}`,
              });
            });
          }}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          清除历史
        </Button>
      </div>

      <div className="border-l-2 border-muted pl-4 space-y-4">
        {sortedHistory.map((record, index) => (
          <div key={record.id} className="relative">
            {/* 连接线 */}
            {index < sortedHistory.length - 1 && (
              <div className="absolute left-[-21px] top-6 h-full w-px bg-muted" />
            )}

            <HistoryItem
              record={record}
              entityType={entityType}
              showActions={true}
              onUndo={handleUndo}
            />
          </div>
        ))}
      </div>
    </div>
  );
}