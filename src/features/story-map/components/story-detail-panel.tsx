'use client';

/**
 * 故事详情面板组件
 */

import { memo } from 'react';
import { X, Clock, Tag, CheckCircle2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserStory } from '@/types/user-story';
import { Priority, Project } from '@/types';
import { cn } from '@/lib/utils';
import { StoryTaskPanel } from './story-task-panel';

interface StoryDetailPanelProps {
  story: UserStory | null;
  journeyName?: string;
  project: Project;
  onClose: () => void;
  onEdit?: (story: UserStory) => void;
}

const priorityLabels: Record<Priority, string> = {
  [Priority.HIGH]: '高优先级',
  [Priority.MEDIUM]: '中优先级',
  [Priority.LOW]: '低优先级',
};

const priorityColors: Record<Priority, string> = {
  [Priority.HIGH]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  [Priority.MEDIUM]: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  [Priority.LOW]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

export const StoryDetailPanel = memo<StoryDetailPanelProps>(
  ({ story, journeyName, project, onClose, onEdit }) => {
    if (!story) {
      return (
        <Card className="w-80 h-full flex items-center justify-center">
          <p className="text-muted-foreground">选择故事查看详情</p>
        </Card>
      );
    }

    const taskCount = story.tasks?.length ?? 0;

    return (
      <Card className="w-80 h-full flex flex-col overflow-hidden">
        {/* 头部 */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="font-mono shrink-0">
              {story.id}
            </Badge>
            <Badge className={cn(priorityColors[story.priority], 'shrink-0')}>
              {priorityLabels[story.priority]}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        {/* Tab 导航 */}
        <Tabs defaultValue="detail" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 shrink-0">
            <TabsTrigger value="detail" className="flex-1 text-xs">详情</TabsTrigger>
            <TabsTrigger value="tasks" className="flex-1 text-xs">
              任务
              {taskCount > 0 && (
                <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded-full px-1">
                  {taskCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 详情 Tab */}
          <TabsContent value="detail" className="flex-1 overflow-y-auto m-0">
            <div className="px-4 py-2 space-y-4">
              {/* 旅程信息 */}
              {journeyName && (
                <div className="text-sm text-muted-foreground">
                  所属旅程: <span className="font-medium text-foreground">{journeyName}</span>
                </div>
              )}

              <Separator />

              {/* 标题 */}
              <div>
                <h3 className="font-semibold text-base leading-tight">{story.title}</h3>
              </div>

              {/* 估算工时 */}
              {story.estimation > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>估算工时: {story.estimation} 小时</span>
                </div>
              )}

              <Separator />

              {/* 详细描述 */}
              {story.description && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">详细描述</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {story.description}
                  </p>
                </div>
              )}

              {/* 标签 */}
              {story.tags && story.tags.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium">标签</h4>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {story.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 验收标准 */}
              {story.acceptance_criteria && story.acceptance_criteria.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium">验收标准</h4>
                    </div>
                    <ul className="space-y-2">
                      {story.acceptance_criteria.map((criteria, index) => {
                        const criteriaText =
                          typeof criteria === 'string'
                            ? criteria
                            : (criteria as { description?: string }).description || JSON.stringify(criteria);
                        return (
                          <li
                            key={index}
                            className="text-sm text-muted-foreground flex items-start gap-2"
                          >
                            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>{criteriaText}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              )}

              {/* 元数据 */}
              <Separator />
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>创建时间: {new Date(story.created_at).toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>更新时间: {new Date(story.updated_at).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>

              {/* 编辑按钮 */}
              <div className="pb-2">
                <Button variant="outline" className="w-full" onClick={() => onEdit?.(story)}>
                  编辑故事
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* 任务 Tab */}
          <TabsContent value="tasks" className="flex-1 overflow-y-auto m-0">
            <div className="px-4 py-3">
              <StoryTaskPanel story={story} project={project} />
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    );
  }
);

StoryDetailPanel.displayName = 'StoryDetailPanel';