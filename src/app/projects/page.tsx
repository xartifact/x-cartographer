/**
 * 项目页面入口
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ArrowLeft, Upload } from 'lucide-react';
import { ProjectList, ProjectCreateDialog } from '@/features/projects/components';
import { ImportDialog } from '@/features/projects/components/import-dialog';
import { useProjectStore } from '@/features/projects/stores';
import { Button } from '@/components/ui/button';

export default function ProjectsPage() {
  const { initialize, importFromToml } = useProjectStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleCreateSuccess = (projectId: string) => {
    setShowCreateDialog(false);
    window.location.href = `/projects/${projectId}`;
  };

  const handleImportSuccess = (projectData: any) => {
    const project = importFromToml(projectData);
    setShowImportDialog(false);
    window.location.href = `/projects/${project.id}`;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
          <h1 className="text-3xl font-bold">项目管理</h1>
          <p className="text-muted-foreground mt-1">管理您的产品路线图和用户故事</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            导入 TOML
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建项目
          </Button>
        </div>
      </div>

      <ProjectList onCreateClick={() => setShowCreateDialog(true)} />

      {showCreateDialog && (
        <ProjectCreateDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={handleCreateSuccess}
        />
      )}

      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImportSuccess}
      />
    </div>
  );
}