/**
 * 项目详情页面
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings, Map, ListTodo, FileText, Upload, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/features/projects/stores';
import { ImportDialog } from '@/features/projects/components/import-dialog';
import { RequirementsPage } from '@/features/requirements/components/requirements-page';
import { DataBrowserPage } from '@/features/data-browser/components/data-browser-page';
import { StoryMapCanvas } from '@/features/story-map';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { projects, isLoading: loading, initialize, mergeTomlToProject } = useProjectStore();
  const [currentProject, setCurrentProject] = useState(projects.find(p => p.id === params.id));
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const project = projects.find(p => p.id === params.id);
    if (!project && !loading) {
      // 项目不存在，返回项目列表
      router.push('/projects');
    }
    setCurrentProject(project);
  }, [params.id, projects, loading, router]);

  const handleImport = (projectData: any) => {
    if (projectData._projectId && projectData._mode) {
      // 项目级别导入
      const projectId = projectData._projectId;
      const mode = projectData._mode;
      delete projectData._projectId;
      delete projectData._mode;

      mergeTomlToProject(projectId, projectData, mode);
      // 刷新当前项目数据
      const updated = projects.find(p => p.id === projectId);
      setCurrentProject(updated);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">项目不存在</p>
            <Link href="/projects">
              <Button>返回项目列表</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ArrowLeft className="h-4 w-4" />
            返回项目列表
          </Link>
          <h1 className="text-3xl font-bold">{currentProject.name}</h1>
          <p className="text-muted-foreground mt-1">{currentProject.description}</p>
        </div>
        <div className="flex gap-2">
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
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            设置
          </Button>
        </div>
      </div>

      {/* 标签页 */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <FileText className="h-4 w-4 mr-2" />
            概览
          </TabsTrigger>
          <TabsTrigger value="requirements">
            <FileText className="h-4 w-4 mr-2" />
            需求
          </TabsTrigger>
          <TabsTrigger value="story-map">
            <Map className="h-4 w-4 mr-2" />
            故事地图
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ListTodo className="h-4 w-4 mr-2" />
            任务
          </TabsTrigger>
          <TabsTrigger value="data">
            <Database className="h-4 w-4 mr-2" />
            数据
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="requirements">
          <RequirementsPage />
        </TabsContent>

        <TabsContent value="story-map">
          <div className="border rounded-lg h-[600px] overflow-hidden">
            <StoryMapCanvas
              journeys={currentProject.user_journeys || []}
              projectId={currentProject.id}
              className="h-full"
            />
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <div className="border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">任务管理功能开发中...</p>
          </div>
        </TabsContent>

        <TabsContent value="data">
          <DataBrowserPage journeys={currentProject.user_journeys || []} />
        </TabsContent>
      </Tabs>

      {/* 导入对话框 */}
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
        projectId={params.id as string}
        mode={importMode}
      />
    </div>
  );
}
