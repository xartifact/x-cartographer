/**
 * 数据浏览页面组件
 */

'use client';

import { useMemo, useState } from 'react';
import { Database, BarChart2, List } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from '@x-cartographer/ui';
import { UserJourney } from '@/types';
import { JourneyList } from './journey-list';
import { StoryList } from './story-list';

interface DataBrowserPageProps {
  journeys: UserJourney[];
}

type ViewMode = 'overview' | 'journeys' | 'stories';

export function DataBrowserPage({ journeys }: DataBrowserPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  // 计算统计数据
  const stats = useMemo(() => {
    const journeyCount = journeys.length;
    const storyCount = journeys.reduce((acc, journey) => acc + (journey.stories?.length || 0), 0);
    const highPriorityCount = journeys.reduce(
      (acc, journey) =>
        acc + journey.stories?.filter((story) => story.priority === 'high').length || 0,
      0
    );
    const mediumPriorityCount = journeys.reduce(
      (acc, journey) =>
        acc + journey.stories?.filter((story) => story.priority === 'medium').length || 0,
      0
    );
    const lowPriorityCount = journeys.reduce(
      (acc, journey) =>
        acc + journey.stories?.filter((story) => story.priority === 'low').length || 0,
      0
    );
    const totalEstimation = journeys.reduce(
      (acc, journey) =>
        acc + journey.stories?.reduce((storyAcc, story) => storyAcc + (story.estimation || 0), 0) ||
        0,
      0
    );

    return {
      journeyCount,
      storyCount,
      highPriorityCount,
      mediumPriorityCount,
      lowPriorityCount,
      totalEstimation,
    };
  }, [journeys]);

  if (journeys.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Database className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">暂无数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计概览 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3">
            <CardTitle className="text-sm font-medium">用户旅程</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold">{stats.journeyCount}</div>
            <p className="text-xs text-muted-foreground">个用户旅程</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3">
            <CardTitle className="text-sm font-medium">用户故事</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold">{stats.storyCount}</div>
            <p className="text-xs text-muted-foreground">个用户故事</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3">
            <CardTitle className="text-sm font-medium">高优先级</CardTitle>
            <Badge variant="destructive" className="h-4 w-4 p-0" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold">{stats.highPriorityCount}</div>
            <p className="text-xs text-muted-foreground">个紧急故事</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3">
            <CardTitle className="text-sm font-medium">总工时估算</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold">{stats.totalEstimation}h</div>
            <p className="text-xs text-muted-foreground">预计开发时间</p>
          </CardContent>
        </Card>
      </div>

      {/* 优先级分布 */}
      <Card>
        <CardHeader className="p-3 pb-0">
          <CardTitle className="text-sm">优先级分布</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-1">
                <span>高优先级</span>
                <span className="text-muted-foreground">
                  {stats.highPriorityCount} ({stats.storyCount > 0 ? Math.round((stats.highPriorityCount / stats.storyCount) * 100) : 0}%)
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{
                    width: `${stats.storyCount > 0 ? (stats.highPriorityCount / stats.storyCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-1">
                <span>中优先级</span>
                <span className="text-muted-foreground">
                  {stats.mediumPriorityCount} ({stats.storyCount > 0 ? Math.round((stats.mediumPriorityCount / stats.storyCount) * 100) : 0}%)
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 transition-all duration-500"
                  style={{
                    width: `${stats.storyCount > 0 ? (stats.mediumPriorityCount / stats.storyCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-1">
                <span>低优先级</span>
                <span className="text-muted-foreground">
                  {stats.lowPriorityCount} ({stats.storyCount > 0 ? Math.round((stats.lowPriorityCount / stats.storyCount) * 100) : 0}%)
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{
                    width: `${stats.storyCount > 0 ? (stats.lowPriorityCount / stats.storyCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 视图切换 */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart2 className="h-4 w-4 mr-1" />
            概览
          </TabsTrigger>
          <TabsTrigger value="journeys">
            <Database className="h-4 w-4 mr-1" />
            旅程视图
          </TabsTrigger>
          <TabsTrigger value="stories">
            <List className="h-4 w-4 mr-1" />
            故事视图
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* 旅程概览 */}
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-base">用户旅程概览</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {journeys.map((journey) => (
                  <div
                    key={journey.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{journey.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{journey.persona}</p>
                    </div>
                    <Badge variant="outline">{journey.stories?.length || 0} 个故事</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 故事概览 */}
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-base">故事分布</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">高优先级</span>
                    <Badge variant="destructive">{stats.highPriorityCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">中优先级</span>
                    <Badge variant="secondary">{stats.mediumPriorityCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">低优先级</span>
                    <Badge className="bg-green-500">{stats.lowPriorityCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium">总故事数</span>
                    <span className="font-bold">{stats.storyCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="journeys" className="mt-4">
          <JourneyList journeys={journeys} />
        </TabsContent>

        <TabsContent value="stories" className="mt-4">
          <StoryList journeys={journeys} />
        </TabsContent>
      </Tabs>
    </div>
  );
}