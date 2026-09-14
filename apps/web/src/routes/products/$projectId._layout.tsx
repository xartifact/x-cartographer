import { Outlet, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useProjectStore } from '@/features/projects/stores';
import { ProjectNav } from '@/components/layout';
import { useProject } from '@/lib/api/hooks';



/**
 * 项目详情嵌套布局（pathless layout）
 *
 * 为 /projects/$projectId 下所有子页面提供统一 ProjectNav + Outlet。
 */
export function ProjectDetailLayout() {
  const { projectId: projectIdRaw } = useParams({ strict: false });
  const projectId = projectIdRaw!;
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId);

  // 进入项目时同步活动项目（URL 直达/刷新也生效）
  useEffect(() => {
    setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);
  const { data: project } = useProject(projectId);

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <ProjectNav projectId={projectId} projectName={project?.name} />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
