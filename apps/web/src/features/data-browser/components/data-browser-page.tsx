/**
 * 数据浏览页面组件
 */

'use client';

import { useMemo, useState } from 'react';
import { Database, BarChart2, List } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from '@x-cartographer/ui';
import { UserActivity } from '@/types';
import { ActivityList } from './activity-list';
import { StoryList } from './story-list';

interface DataBrowserPageProps {
  activities: UserActivity[];
}

type ViewMode = 'overview' | 'activities' | 'stories';

export function DataBrowserPage({ activities }: DataBrowserPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  // 计算统计数据
  const stats = useMemo(() => {
    const activityCount = activities.length;
    const storyCount = activities.reduce((acc, activity) => acc + (activity.stories?.length || 0), 0);
    const highPriorityCount = activities.reduce(
      (acc, activity) =>
        acc + activity.stories?.filter((story) => story.priority === 'high').length || 0,
      0
    );
    const mediumPriorityCount = activities.reduce(
      (acc, activity) =>
        acc + activity.stories?.filter((story) => story.priority === 'medium').length || 0,
      0
    );
    const lowPriorityCount = activities.reduce(
      (acc, activity) =>
        acc + activity.stories?.filter((story) => story.priority === 'low').length || 0,
      0
    );
    const totalEstimation = activities.reduce(
      (acc, activity) =>
        acc + activity.stories?.reduce((storyAcc, story) => storyAcc + (story.estimation || 0), 0) ||
        0,
      0
    );

    return {
      activityCount,
      storyCount,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      totalEstimation,
    };
  }, [activities]);

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          暂无数据
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 概览统计 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">用户活动</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activityCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">用户故事</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.storyCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总估算工时</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEstimation}h</div>
          </CardContent>
        </Card>
      </div>

      {/* 标签页 */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <TabsList>
          <TabsTrigger value="activities">活动列表</TabsTrigger>
          <TabsTrigger value="stories">故事列表</TabsTrigger>
        </TabsList>
        <TabsContent value="activities">
          <ActivityList activities={activities} />
        </TabsContent>
        <TabsContent value="stories">
          <StoryList activities={activities} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
