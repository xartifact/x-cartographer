'use client';

/**
 * 故事批量编辑工具栏（US-006 批量编辑用户故事）
 *
 * 在批量模式下选择多个故事后出现：
 * - 批量修改优先级
 * - 批量添加标签
 * - 批量变更状态
 */

import { useState } from 'react';
import { Tags, Trash2, X, RefreshCw, Tag } from 'lucide-react';
import { Button } from '@x-cartographer/ui';
import { Badge } from '@x-cartographer/ui';
import type { UserStory } from '@/types';
import { Priority } from '@/types';
import type { StoryStatus } from '@x-cartographer/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@x-cartographer/ui';

interface StoryBulkBarProps {
  selectedStories: UserStory[];
  onClearSelection: () => void;
  onUpdatePriority: (storyIds: string[], priority: string) => Promise<void>;
  onAddTags: (storyIds: string[], tags: string[]) => Promise<void>;
  onUpdateStatus: (storyIds: string[], status: StoryStatus) => Promise<void>;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: Priority.HIGH, label: '高优先级' },
  { value: Priority.MEDIUM, label: '中优先级' },
  { value: Priority.LOW, label: '低优先级' },
];

const STATUS_OPTIONS: { value: StoryStatus; label: string }[] = [
  { value: 'backlog', label: '待规划' },
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
];

export function StoryBulkBar({
  selectedStories,
  onClearSelection,
  onUpdatePriority,
  onAddTags,
  onUpdateStatus,
}: StoryBulkBarProps) {
  const [busy, setBusy] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const count = selectedStories.length;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2">
      <Badge variant="secondary">{count} 个故事已选</Badge>

      {/* 批量改优先级 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy || count === 0}>
            修改优先级
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {PRIORITY_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() =>
                run(() =>
                  onUpdatePriority(
                    selectedStories.map((s) => s.id),
                    opt.value
                  )
                )
              }
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 批量加标签 */}
      <div className="flex items-center gap-1">
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && tagInput.trim()) {
              const tags = tagInput
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);
              run(() => onAddTags(selectedStories.map((s) => s.id), tags));
              setTagInput('');
            }
          }}
          placeholder="批量加标签 (逗号分隔)"
          className="h-8 w-44 rounded-md border bg-background px-2 text-xs"
          disabled={busy || count === 0}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={busy || count === 0 || !tagInput.trim()}
          onClick={() => {
            const tags = tagInput
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
            run(() => onAddTags(selectedStories.map((s) => s.id), tags));
            setTagInput('');
          }}
          title="添加标签"
        >
          <Tags className="h-4 w-4" />
        </Button>
      </div>

      {/* 批量改状态 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy || count === 0}>
            修改状态
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {STATUS_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() =>
                run(() =>
                  onUpdateStatus(
                    selectedStories.map((s) => s.id),
                    opt.value
                  )
                )
              }
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {busy && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}

      <Button
        variant="ghost"
        size="sm"
        className="ml-auto text-muted-foreground"
        onClick={onClearSelection}
        disabled={busy}
      >
        <X className="mr-1 h-3 w-3" />
        清除选择
      </Button>
    </div>
  );
}