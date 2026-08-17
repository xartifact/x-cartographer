'use client';

/**
 * 版本选择器：故事详情面板中的排期分配控件
 * 展示所有版本，支持选择/取消（回到待规划池）
 */

import { Calendar } from 'lucide-react';
import { useMilestonesByProject, useUpdateStory } from '@/lib/api/hooks';
import { useQueryClient } from '@tanstack/react-query';

interface MilestoneSelectProps {
  projectId: string;
  value?: string;
  onChange?: (storyId: string, milestoneId: string | null) => void;
  /** 当前故事 ID（由调用方传入以触发更新） */
  storyId?: string;
}

export function MilestoneSelect({ projectId, value, onChange, storyId }: MilestoneSelectProps) {
  const { data: milestones = [] } = useMilestonesByProject(projectId);
  const updateStory = useUpdateStory();
  const queryClient = useQueryClient();

  async function handleChange(milestoneId: string) {
    if (!storyId) return;
    const id = milestoneId || null;
    await updateStory.mutateAsync({ id: storyId, milestoneId: id });
    // 更新后失效项目缓存，让 Roadmap/故事地图重新拉取
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    onChange?.(storyId, id);
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
      <select
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
        value={value ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="所属版本"
      >
        <option value="">待规划（未排期）</option>
        {milestones.map((m: { id: string; name: string; status: string }) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.status === 'active' ? '（进行中）' : m.status === 'completed' ? '（已完成）' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
