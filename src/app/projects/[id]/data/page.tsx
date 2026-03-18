/**
 * 数据浏览器独立页面
 *
 * 路由: /projects/:id/data
 */

'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/features/projects/stores';
import { DataBrowserPage } from '@/features/data-browser';

export default function DataRoutePage() {
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
        <h1 className="text-2xl font-bold">数据浏览器</h1>
        <p className="text-muted-foreground">查看和管理项目的所有数据</p>
      </div>

      {/* 数据浏览器页面 */}
      <DataBrowserPage journeys={project.user_journeys || []} />
    </div>
  );
}
