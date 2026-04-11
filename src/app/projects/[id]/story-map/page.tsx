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
    <div className="h-[calc(100vh-9.5rem)] overflow-hidden">
      <StoryMapCanvas
        journeys={project.user_journeys || []}
        projectId={projectId}
        className="h-full w-full"
      />
    </div>
  );
}
