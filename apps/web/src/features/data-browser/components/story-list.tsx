/**
 * 用户故事列表组件（带搜索筛选功能）
 */

'use client';

import { useMemo, useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@x-cartographer/ui';
import { UserJourney, UserStory, Priority } from '@/types';
import { StoryCard } from './story-card';
import { cn } from '@/lib/utils';

interface StoryListProps {
  journeys: UserJourney[];
}

interface FilterState {
  search: string;
  priority: Priority | 'all';
  journeyId: 'all';
}

export function StoryList({ journeys }: StoryListProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    priority: 'all',
    journeyId: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);

  // 提取所有用户故事并关联旅程名称
  const allStories: Array<UserStory & { journeyName: string }> = useMemo(() => {
    const stories: Array<UserStory & { journeyName: string }> = [];
    journeys.forEach((journey) => {
      journey.stories?.forEach((story) => {
        stories.push({ ...story, journeyName: journey.name });
      });
    });
    return stories;
  }, [journeys]);

  // 筛选后的故事列表
  const filteredStories = useMemo(() => {
    return allStories.filter((story) => {
      // 标题搜索
      if (filters.search && !story.title.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      // 优先级筛选
      if (filters.priority !== 'all' && story.priority !== filters.priority) {
        return false;
      }
      // 用户旅程筛选
      if (filters.journeyId !== 'all') {
        const journey = journeys.find((j) => j.id === filters.journeyId);
        if (!journey || !journey.stories?.some((s) => s.id === story.id)) {
          return false;
        }
      }
      return true;
    });
  }, [allStories, filters, journeys]);

  // 统计信息
  const stats = useMemo(() => {
    const highCount = allStories.filter((s) => s.priority === 'high').length;
    const mediumCount = allStories.filter((s) => s.priority === 'medium').length;
    const lowCount = allStories.filter((s) => s.priority === 'low').length;
    return { high: highCount, medium: mediumCount, low: lowCount, total: allStories.length };
  }, [allStories]);

  const clearFilters = () => {
    setFilters({ search: '', priority: 'all', journeyId: 'all' });
  };

  const hasActiveFilters = filters.search || filters.priority !== 'all' || filters.journeyId !== 'all';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">用户故事列表</h3>
        <div className="flex gap-2 items-center">
          {/* 统计信息 */}
          <div className="hidden sm:flex gap-2 mr-2">
            <Badge variant="outline" className="text-xs">
              总计: {stats.total}
            </Badge>
            <Badge variant="destructive" className="text-xs">
              高: {stats.high}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              中: {stats.medium}
            </Badge>
            <Badge className="text-xs bg-green-500">
              低: {stats.low}
            </Badge>
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            筛选
          </Button>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索故事标题..."
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          className="pl-9 pr-9"
        />
        {filters.search && (
          <button
            onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <Card>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-sm">筛选条件</CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 优先级筛选 */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">优先级</label>
                <div className="flex flex-wrap gap-1">
                  {(['all', 'high', 'medium', 'low'] as const).map((priority) => (
                    <button
                      key={priority}
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          priority: priority as Priority | 'all',
                        }))
                      }
                      className={cn(
                        'px-2 py-1 text-xs rounded-md transition-colors',
                        filters.priority === (priority as Priority | 'all')
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      )}
                    >
                      {priority === 'all' ? '全部' : priorityConfigLabels[priority]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 用户旅程筛选 */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">用户旅程</label>
                <select
                  value={filters.journeyId}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, journeyId: e.target.value as 'all' }))
                  }
                  className="w-full px-2 py-1 text-sm border rounded-md bg-background"
                >
                  <option value="all">全部旅程</option>
                  {journeys.map((journey) => (
                    <option key={journey.id} value={journey.id}>
                      {journey.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 清空筛选 */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                清空筛选
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* 移动端统计信息 */}
      <div className="sm:hidden flex gap-2 overflow-x-auto pb-2">
        <Badge variant="outline" className="text-xs shrink-0">
          总计: {stats.total}
        </Badge>
        <Badge variant="destructive" className="text-xs shrink-0">
          高: {stats.high}
        </Badge>
        <Badge variant="secondary" className="text-xs shrink-0">
          中: {stats.medium}
        </Badge>
        <Badge className="text-xs shrink-0 bg-green-500">
          低: {stats.low}
        </Badge>
      </div>

      {/* 故事列表 */}
      <div className="space-y-2">
        {filteredStories.length > 0 ? (
          filteredStories.map((story) => (
            <StoryCard key={story.id} story={story} journeyName={story.journeyName} />
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                {hasActiveFilters ? '没有找到匹配的故事' : '暂无用户故事'}
              </p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  清除筛选条件
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

const priorityConfigLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};