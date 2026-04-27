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
import { Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/features/projects/stores';
import { ImportDialog } from '@/features/projects/components/import-dialog';
import { serializeProjectToToml, serializeToTomlText } from '@/lib/toml/parser';
import type { TomlParsedProject } from '@/features/projects/types';

/**
 * 将 DB Project 模型转换为 TOML 导出所需的简化 Project 格式
 */
function toTomlProject(project: {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
  metadata?: { version?: string; tech_stack?: string[] } | null;
  user_journeys?: unknown[];
}): TomlParsedProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? '',
    version: project.metadata?.version || '1.0.0',
    tech_stack: project.metadata?.tech_stack?.length
      ? project.metadata.tech_stack
      : ['未指定'],
    created_at: project.created_at,
    updated_at: project.updated_at,
    user_journeys: (project.user_journeys ?? []) as TomlParsedProject['user_journeys'],
  };
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const {
    projects,
    isLoading: loading,
    mergeTomlToProject,
  } = useProjectStore();
  const [currentProject, setCurrentProject] = useState(
    projects.find((p) => p.id === params.id)
  );
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // 从 URL 参数获取项目 ID
  const projectId = params.id as string;

  useEffect(() => {
    const project = projects.find((p) => p.id === params.id);
    if (!project && !loading) {
      // 项目不存在，返回项目列表
      router.push('/projects');
    }
    setCurrentProject(project);
  }, [params.id, projects, loading, router]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleImport = async (projectData: any) => {
    if (projectData._projectId && projectData._mode) {
      // 项目级别导入
      const pid = projectData._projectId as string;
      const mode = projectData._mode as 'merge' | 'replace';
      delete projectData._projectId;
      delete projectData._mode;

      await mergeTomlToProject(pid, projectData, mode);
      // 刷新当前项目数据
      const updated = projects.find((p) => p.id === pid);
      setCurrentProject(updated);
    }
  };

  const handleExportToml = async () => {
    if (!currentProject) return;
    try {
      const tomlData = serializeProjectToToml(toTomlProject(currentProject));
      const tomlText = await serializeToTomlText(tomlData);
      const blob = new Blob([tomlText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const safeName = currentProject.name.replace(/[/\\:*?"<>|]/g, '_');
      anchor.download = `${safeName}.toml`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('TOML 导出失败:', error);
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  if (loading || !currentProject) {
    return null; // 由 layout 处理加载和不存在状态
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 项目概览标题区域 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{currentProject.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {currentProject.description}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportToml}>
            <Download className="mr-2 h-4 w-4" />
            导出 TOML
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setImportMode('merge');
              setShowImportDialog(true);
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            导入 TOML
          </Button>
        </div>
      </div>

      {/* 概览内容 */}
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-6">
            <h3 className="mb-2 font-semibold">项目信息</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">项目 ID</dt>
                <dd className="font-mono text-xs">{currentProject.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">创建时间</dt>
                <dd>
                  {new Date(currentProject.created_at).toLocaleDateString(
                    'zh-CN'
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">更新时间</dt>
                <dd>
                  {new Date(currentProject.updated_at).toLocaleDateString(
                    'zh-CN'
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border p-6">
            <h3 className="mb-2 font-semibold">统计信息</h3>
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
