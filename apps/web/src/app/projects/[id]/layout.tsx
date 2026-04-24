/**
 * 项目详情页面布局
 *
 * 为所有项目详情子页面提供统一的布局和导航
 * 路由: /projects/:id/*
 */

'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectStore } from '@/features/projects/stores';
import { ProjectNav } from '@/components/layout';
import { Button } from '@/components/ui/button';

export default function ProjectDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { projects, isLoading: loading, initialize } = useProjectStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const project = projects.find((p) => p.id === projectId);

  // 加载中状态
  if (loading) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  // 项目不存在
  if (!project && !loading) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">项目不存在</p>
            <Button onClick={() => router.push('/projects')}>
              返回项目列表
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* 项目导航 */}
      {project && (
        <ProjectNav projectId={projectId} projectName={project.name} />
      )}
      {/* 页面内容 */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
