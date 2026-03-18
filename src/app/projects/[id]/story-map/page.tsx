/**
 * 故事地图独立页面
 *
 * 路由: /projects/:id/story-map
 */

'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/features/projects/stores';
import { StoryMapCanvas } from '@/features/story-map';

export default function StoryMapRoutePage() {
  const params = useParams();
  const projectId = params.id as string;
  const { projects } = useProjectStore();

  const project = React.useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  // 项目不存在时由 layout 处理
  if (!project) {
    return null;
  }

  return (
    <div className="container py-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">用户故事地图</h1>
        <p className="text-muted-foreground">可视化展示用户旅程、用户故事和任务</p>
      </div>

      {/* 故事地图画布 */}
      <div className="border rounded-lg h-[600px] overflow-hidden">
        <StoryMapCanvas
          journeys={project.user_journeys || []}
          projectId={projectId}
          className="h-full"
        />
      </div>
    </div>
  );
}
