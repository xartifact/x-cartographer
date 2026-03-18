/**
 * 项目详情页面
 *
 * 路由: /projects/:id
 * - 概览标签页（当前页面）
 * - 独立功能路由:
 *   - /projects/:id/requirements
 *   - /projects/:id/story-map
 *   - /projects/:id/tasks
 *   - /projects/:id/data
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/features/projects/stores';
import { ImportDialog } from '@/features/projects/components/import-dialog';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { projects, isLoading: loading, mergeTomlToProject } = useProjectStore();
  const [currentProject, setCurrentProject] = useState(projects.find(p => p.id === params.id));
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // 从 URL 参数获取项目 ID
  const projectId = params.id as string;

  useEffect(() => {
    const project = projects.find(p => p.id === params.id);
    if (!project && !loading) {
      // 项目不存在，返回项目列表
      router.push('/projects');
    }
    setCurrentProject(project);
  }, [params.id, projects, loading, router]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleImport = (projectData: any) => {
    if (projectData._projectId && projectData._mode) {
      // 项目级别导入
      const projectId = projectData._projectId as string;
      const mode = projectData._mode as 'merge' | 'replace';
      delete projectData._projectId;
      delete projectData._mode;

      mergeTomlToProject(projectId, projectData, mode);
      // 刷新当前项目数据
      const updated = projects.find(p => p.id === projectId);
      setCurrentProject(updated);
    }
  };

  if (loading || !currentProject) {
    return null; // 由 layout 处理加载和不存在状态
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 项目概览标题区域 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{currentProject.name}</h1>
          <p className="text-muted-foreground mt-1">{currentProject.description}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setImportMode('merge');
            setShowImportDialog(true);
          }}
        >
          <Upload className="h-4 w-4 mr-2" />
          导入 TOML
        </Button>
      </div>

      {/* 概览内容 */}
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2">项目信息</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">项目 ID</dt>
                <dd className="font-mono text-xs">{currentProject.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">创建时间</dt>
                <dd>{new Date(currentProject.created_at).toLocaleDateString('zh-CN')}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">更新时间</dt>
                <dd>{new Date(currentProject.updated_at).toLocaleDateString('zh-CN')}</dd>
              </div>
            </dl>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2">统计信息</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">用户旅程</dt>
                <dd>{currentProject.user_journeys?.length || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">用户故事</dt>
                <dd>
                  {currentProject.user_journeys?.reduce(
                    (acc, journey) => acc + (journey.stories?.length || 0),
                    0
                  ) || 0}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* 导入对话框 */}
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
        projectId={projectId}
        mode={importMode}
      />
    </div>
  );
}
