'use client';

/**
 * 故事详情面板组件
 *
 * 样式对齐任务详情（TaskDetailSheet）：SheetHeader 头部（ID + 状态 + 标题 + 归属旅程）、
 * 基本信息 grid、描述/验收标准/标签分节、任务拆解、操作按钮。
 * 内容按故事适配：所属版本（MilestoneSelect）、验收标准、任务拆解面板。
 *
 * 由调用方以 Sheet 抽屉包裹（roadmap / stories 管理页），或嵌入故事地图浮层。
 */

import { memo } from 'react';
import {
  Clock,
  Tag,
  CheckCircle2,
  Calendar,
  Trash2,
  GitBranch,
  ListChecks,
  Layers,
  CircleDot,
} from 'lucide-react';
import { Button, Badge, Separator } from '@x-cartographer/ui';
import { StoryTaskPanel } from './story-task-panel';
import { MilestoneSelect } from '@/features/roadmap/components/milestone-select';
import { StatusBadge } from '@/features/tasks/components/status-badge';
import type { UserStory } from '@/types/user-story';
import { Priority, type Project } from '@/types';
import { cn } from '@/lib/utils';
import type { StoryStatus } from '@/types';

interface StoryDetailPanelProps {
  story: UserStory | null;
  journeyName?: string;
  project: Pick<
    Project,
    'id' | 'name' | 'description' | 'metadata' | 'settings' | 'user_journeys'
  >;
  onClose: () => void;
  onEdit?: (story: UserStory) => void;
  onDelete?: (story: UserStory) => void;
  /** 覆盖容器宽度/尺寸类（默认自撑；置于 Sheet 内传 h-full w-full） */
  className?: string;
}

const priorityLabels: Record<Priority, string> = {
  [Priority.HIGH]: '高优先级',
  [Priority.MEDIUM]: '中优先级',
  [Priority.LOW]: '低优先级',
};

const priorityColors: Record<Priority, string> = {
  [Priority.HIGH]: 'text-red-600',
  [Priority.MEDIUM]: 'text-amber-600',
  [Priority.LOW]: 'text-gray-500',
};



/** 信息项（对齐任务详情 InfoItem） */
function InfoItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export const StoryDetailPanel = memo<StoryDetailPanelProps>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- onClose 为公开回调，供调用方 Sheet 关闭
  ({ story, journeyName, project, onClose, onEdit, onDelete, className }) => {
    if (!story) {
      return null;
    }

    const tasks = story.tasks ?? [];
    const doneTasks = tasks.filter((t) => t.status === 'done').length;
    const taskCount = tasks.length;

    return (
      <div className={cn('flex h-full w-full flex-col overflow-hidden', className)}>
        {/* 头部（对齐任务详情 SheetHeader） */}
        <div className="flex items-start gap-3 space-y-1">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {story.id}
              </span>
              {story.status && (
                <StatusBadge
                  status={story.status as StoryStatus}
                  isTask={false}
                  size="sm"
                />
              )}
            </div>
            <h3 className="text-lg font-semibold leading-snug">{story.title}</h3>
            {journeyName && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                {journeyName}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {/* 基本信息 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">基本信息</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* 类型 */}
              <InfoItem icon={<CircleDot className="h-3.5 w-3.5" />} label="类型">
                <span>用户故事</span>
              </InfoItem>
              {/* 优先级 */}
              <InfoItem icon={<Tag className="h-3.5 w-3.5" />} label="优先级">
                <span
                  className={cn(
                    'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                    story.priority === 'high' &&
                      'border-red-200 bg-red-50 text-red-600',
                    story.priority === 'medium' &&
                      'border-amber-200 bg-amber-50 text-amber-600',
                    story.priority === 'low' &&
                      'border-green-200 bg-green-50 text-green-600',
                    priorityColors[story.priority]
                  )}
                >
                  {priorityLabels[story.priority]}
                </span>
              </InfoItem>
              {/* 估算工时 */}
              <InfoItem icon={<Clock className="h-3.5 w-3.5" />} label="估算工时">
                <span>{story.estimation > 0 ? `${story.estimation} 小时` : '未估算'}</span>
              </InfoItem>
              {/* 任务进度 */}
              <InfoItem icon={<ListChecks className="h-3.5 w-3.5" />} label="任务进度">
                <span>{taskCount > 0 ? `${doneTasks}/${taskCount}` : '无任务'}</span>
              </InfoItem>
              {/* 所属旅程 */}
              {journeyName && (
                <InfoItem icon={<GitBranch className="h-3.5 w-3.5" />} label="所属旅程">
                  <span>{journeyName}</span>
                </InfoItem>
              )}
              {/* 创建时间 */}
              {story.created_at && (
                <InfoItem icon={<Calendar className="h-3.5 w-3.5" />} label="创建时间">
                  <span className="text-xs">
                    {new Date(story.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </InfoItem>
              )}
            </div>
          </section>

          <Separator />

          {/* 排期：所属版本 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">排期版本</h3>
            <MilestoneSelect
              projectId={project.id}
              value={story.milestone_id}
              storyId={story.id}
            />
          </section>

          <Separator />

          {/* 描述 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">描述</h3>
            {story.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {story.description}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground/60">暂无描述</p>
            )}
          </section>

          <Separator />

          {/* 验收标准 */}
          {story.acceptance_criteria && story.acceptance_criteria.length > 0 && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">验收标准</h3>
                <ul className="space-y-2">
                  {story.acceptance_criteria.map((criteria, index) => {
                    const criteriaText =
                      typeof criteria === 'string'
                        ? criteria
                        : (criteria as { description?: string }).description ||
                          JSON.stringify(criteria);
                    return (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{criteriaText}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
              <Separator />
            </>
          )}

          {/* 标签 */}
          {story.tags && story.tags.length > 0 && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">标签</h3>
                <div className="flex flex-wrap gap-1.5">
                  {story.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </section>
              <Separator />
            </>
          )}

          {/* 任务拆解 */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">任务拆解</h3>
              {taskCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {taskCount}
                </Badge>
              )}
            </div>
            <StoryTaskPanel story={story} />
          </section>

          <Separator />

          {/* 更新时间 */}
          {story.updated_at && (
            <div className="text-xs text-muted-foreground">
              更新时间:{' '}
              {new Date(story.updated_at).toLocaleDateString('zh-CN')}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 pb-2">
            <Button variant="outline" className="flex-1" onClick={() => onEdit?.(story)}>
              编辑故事
            </Button>
            {onDelete && (
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(story)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

StoryDetailPanel.displayName = 'StoryDetailPanel';
