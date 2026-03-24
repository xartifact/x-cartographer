/**
 * 项目列表组件
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, FolderOpen, Calendar, MapPin, MoreHorizontal, Trash2, Edit2, Upload } from 'lucide-react';
import { useProjectStore } from '@/features/projects/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatRelativeTime } from '@/utils/format';
import { cn } from '@/lib/utils';
import { ImportDialog } from './import-dialog';

/**
 * 格式化项目统计信息
 */
function formatProjectStats(project: {
  user_journeys?: Array<{ id: string }>;
  metadata?: { total_stories?: number; total_tasks?: number };
}): { journeyCount: number; storyCount: number; taskCount: number } {
  return {
    journeyCount: project.user_journeys?.length || 0,
    storyCount: project.metadata?.total_stories || 0,
    taskCount: project.metadata?.total_tasks || 0,
  };
}

/**
 * 项目卡片组件
 */
function ProjectCard({
  project,
  isActive,
  onSelect,
  onDelete,
}: {
  project: {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
    user_journeys?: Array<{ id: string }>;
    metadata?: { total_stories?: number; total_tasks?: number; tags?: string[] };
  };
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const stats = formatProjectStats(project);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (window.confirm(`确定要删除项目 "${project.name}" 吗？此操作不可撤销。`)) {
      setIsDeleting(true);
      try {
        await onDelete();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <Link href={`/projects/${project.id}`} onClick={onSelect}>
      <Card
        className={cn(
          'h-full transition-all duration-200 hover:shadow-md cursor-pointer group',
          isActive && 'ring-2 ring-primary'
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg font-semibold truncate">{project.name}</CardTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${project.id}/edit`}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    编辑
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? '删除中...' : '删除'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{project.description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 统计信息 */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{stats.journeyCount} 旅程</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{stats.storyCount} 故事</span>
            </div>
          </div>

          {/* 标签 */}
          {project.metadata?.tags && project.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.metadata.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {project.metadata.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{project.metadata.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* 更新时间 */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t">
            <Calendar className="h-3 w-3" />
            <span>更新于 {formatRelativeTime(project.updated_at)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * 项目搜索组件
 */
function ProjectSearch() {
  const { searchQuery, setSearchQuery } = useProjectStore();

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="搜索项目..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

/**
 * 空状态组件
 */
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center py-12">
      <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">还没有项目</h3>
      <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
        创建您的第一个项目，开始管理产品路线图和用户故事地图
      </p>
      <Button onClick={onCreate}>
        <Plus className="h-4 w-4 mr-2" />
        创建项目
      </Button>
    </Card>
  );
}

/**
 * 加载状态组件
 */
function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-muted rounded" />
              <div className="h-6 w-32 bg-muted rounded" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-4 w-full bg-muted rounded mb-2" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * 项目列表主组件
 */
export function ProjectList({ onCreateClick }: { onCreateClick: () => void }) {
  const { projects, getFilteredProjects, setActiveProject, removeProject, isLoading, error, clearError } = useProjectStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredProjects = getFilteredProjects();

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={clearError}>
          重试
        </Button>
      </Card>
    );
  }

  if (projects.length === 0) {
    return <EmptyState onCreate={onCreateClick} />;
  }

  if (filteredProjects.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-12">
        <Search className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">未找到项目</h3>
        <p className="text-sm text-muted-foreground">尝试不同的搜索关键词</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 搜索和工具栏 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <ProjectSearch />
        <div className="flex items-center gap-2">
          {/* 视图切换 */}
          {/* TODO: 添加视图切换按钮 */}
        </div>
      </div>

      {/* 项目列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            isActive={false}
            onSelect={() => setActiveProject(project.id)}
            onDelete={() => removeProject(project.id)}
          />
        ))}
      </div>

      {/* 项目数量统计 */}
      <div className="text-sm text-muted-foreground text-center">
        共 {filteredProjects.length} 个项目
        {filteredProjects.length !== projects.length && (
          <span>（已筛选 {projects.length - filteredProjects.length} 个）</span>
        )}
      </div>
    </div>
  );
}

/**
 * 项目列表页面组件
 */
export default function ProjectListPage() {
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const { importFromToml } = useProjectStore();

  const handleCreateClick = () => {
    setShowCreateDialog(true);
  };

  const handleImportClick = () => {
    setShowImportDialog(true);
  };

  const handleCreateSuccess = (projectId: string) => {
    setShowCreateDialog(false);
    router.push(`/projects/${projectId}`);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleImportSuccess = async (projectData: any) => {
    const project = await importFromToml(projectData);
    setShowImportDialog(false);
    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">项目管理</h1>
          <p className="text-muted-foreground mt-1">管理您的产品路线图和用户故事</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImportClick}>
            <Upload className="h-4 w-4 mr-2" />
            导入 TOML
          </Button>
          <Button onClick={handleCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            新建项目
          </Button>
        </div>
      </div>

      <ProjectList onCreateClick={handleCreateClick} />

      {/* 创建项目对话框 */}
      {showCreateDialog && (
        <ProjectCreateDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* 导入 TOML 对话框 */}
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImportSuccess}
      />
    </div>
  );
}

// 导入缺失的依赖
import { useRouter } from 'next/navigation';
import { ProjectCreateDialog } from './project-create-dialog';

// 导入缺失的 UI 组件
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';