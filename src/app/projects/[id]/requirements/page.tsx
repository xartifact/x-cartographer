/**
 * 需求分析独立页面
 *
 * 路由: /projects/:id/requirements
 */

'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/features/projects/stores';
import { RequirementsPage } from '@/features/requirements';

export default function RequirementsRoutePage() {
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
        <h1 className="text-2xl font-bold">AI 辅助需求分析</h1>
        <p className="text-muted-foreground">输入产品需求，AI 自动分析生成用户角色、功能点和用户旅程</p>
      </div>

      {/* 需求分析页面 */}
      <RequirementsPage />
    </div>
  );
}
