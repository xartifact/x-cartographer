/**
 * 任务管理独立页面
 *
 * 路由: /projects/:id/tasks
 */

'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/features/projects/stores';
import { TasksPage } from '@/features/tasks/components';

export default function TasksRoutePage() {
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
      {/* 任务页面 */}
      <TasksPage project={project} />
    </div>
  );
}
