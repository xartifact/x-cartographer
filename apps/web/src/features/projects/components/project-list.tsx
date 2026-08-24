/**
 * 项目列表组件
 */

'use client';

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Plus,
  Search,
  FolderOpen,
  Calendar,
  MapPin,
  MoreHorizontal,
  Trash2,
  Edit2,
  Upload,
  Download,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from '@x-cartographer/ui';
import { useProjectStore, selectSearchQuery } from '@/features/projects/stores';
import { useProjectActions } from '../hooks';
import { formatRelativeTime } from '@/utils/format';
import { cn } from '@/lib/utils';
import { serializeProjectToToml, serializeToTomlText } from '@/lib/toml/parser';
import type { TomlParsedProject } from '@/features/projects/types';
import { useProjects, useSaveFullProject } from '@/lib/api/hooks';
import { useNavigate } from '@tanstack/react-router';
import { nanoid } from 'nanoid';
import { ProjectCreateDialog } from './project-create-dialog';
import { ProjectEditDialog } from './project-edit-dialog';
import { type Priority, type Project } from '@x-cartographer/shared';


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
import { ImportDialog } from './import-dialog';

/**
 * 格式化项目统计信息。
 *
 * 故事/任务数从旅程树实时统计（API 返回的 Project.user_journeys.stories / .tasks 已展开），
 * 不依赖 metadata.total_stories/total_tasks —— 该字段服务端从未写入，恒为 undefined，
 * 读它会得到错误的 0。
 */
export function formatProjectStats(project: {
  user_journeys?: Array<{
    id: string;
    stories?: Array<{ id: string; tasks?: Array<{ id: string }> }>;
  }>;
  metadata?: { total_stories?: number; total_tasks?: number };
}): { journeyCount: number; storyCount: number; taskCount: number } {
  const journeys = project.user_journeys ?? [];
  const storyCount = journeys.reduce((acc, j) => acc + (j.stories?.length ?? 0), 0);
  const taskCount = journeys.reduce(
    (acc, j) => acc + (j.stories ?? []).reduce((a, s) => a + (s.tasks?.length ?? 0), 0),
    0,
  );
  return {
    journeyCount: journeys.length,
    // metadata 兜底（历史数据可能带快照计数，但不应优先于实时树）
    storyCount: storyCount || project.metadata?.total_stories || 0,
    taskCount: taskCount || project.metadata?.total_tasks || 0,
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
  onEdit,
  onExport,
}: {
  project: {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
    user_journeys?: Array<{ id: string }>;
    metadata?: {
      total_stories?: number;
      total_tasks?: number;
      tags?: string[];
    };
  };
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onExport: () => void;
}) {
  const stats = formatProjectStats(project);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      window.confirm(`确定要删除项目 "${project.name}" 吗？此操作不可撤销。`)
    ) {
      setIsDeleting(true);
      try {
        await onDelete();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <Link to={`/projects/$projectId`} params={{ projectId: project.id }} onClick={onSelect}>
      <Card
        className={cn(
          'group h-full cursor-pointer transition-all duration-200 hover:shadow-md',
          isActive && 'ring-2 ring-primary'
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="truncate text-lg font-semibold">
                {project.name}
              </CardTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onExport();
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  导出 TOML
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? '删除中...' : '删除'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {project.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {project.description}
            </p>
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
          <div className="flex items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
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
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
      <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-semibold">还没有项目</h3>
      <p className="mb-4 max-w-sm text-center text-sm text-muted-foreground">
        创建您的第一个项目，开始管理产品路线图和用户故事地图
      </p>
      <Button onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" />
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
              <div className="h-5 w-5 rounded bg-muted" />
              <div className="h-6 w-32 rounded bg-muted" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-2 h-4 w-full rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
export function ProjectList({ onCreateClick }: { onCreateClick: () => void }) {
  const { data: projects = [], isLoading, error, refetch } = useProjects();
  const searchQuery = useProjectStore(selectSearchQuery);
  const { setActiveProjectId } = useProjectStore();
  const { deleteProject } = useProjectActions();
  const [_viewMode, _setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // 客户端过滤（项目数量级较小，无需服务端搜索）
  const filteredProjects = projects.filter((project) =>
    searchQuery.trim()
      ? project.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      : true
  );

  const handleExportToml = async (project: Project) => {
    try {
      const tomlData = serializeProjectToToml(toTomlProject(project));
      const tomlText = await serializeToTomlText(tomlData);
      const blob = new Blob([tomlText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const safeName = project.name.replace(/[/\\:*?"<>|]/g, '_');
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

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="mb-4 text-destructive">{error.message}</p>
        <Button variant="outline" onClick={() => refetch()}>
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
        <Search className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">未找到项目</h3>
        <p className="text-sm text-muted-foreground">尝试不同的搜索关键词</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 搜索和工具栏 */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
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
            onSelect={() => setActiveProjectId(project.id)}
            onDelete={() => deleteProject(project.id)}
            onEdit={() => setEditingProject(project)}
            onExport={() => handleExportToml(project)}
          />
        ))}
      </div>

      {/* 项目数量统计 */}
      <div className="text-center text-sm text-muted-foreground">
        共 {filteredProjects.length} 个项目
        {filteredProjects.length !== projects.length && (
          <span>（已筛选 {projects.length - filteredProjects.length} 个）</span>
        )}
      </div>

      {/* 项目编辑对话框 */}
      {editingProject && (
        <ProjectEditDialog
          project={editingProject}
          open={!!editingProject}
          onOpenChange={(open) => {
            if (!open) setEditingProject(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * 项目列表页面组件
 */
export default function ProjectListPage() {
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const { createProject } = useProjectActions();
  const { mutateAsync: saveFullProject } = useSaveFullProject();

  const handleCreateClick = () => {
    setShowCreateDialog(true);
  };

  const handleImportClick = () => {
    setShowImportDialog(true);
  };

  const handleCreateSuccess = (projectId: string) => {
    setShowCreateDialog(false);
    navigate({ to: `/projects/$projectId`, params: { projectId } });
  };
  const handleImportSuccess = async (
    projectData: Omit<TomlParsedProject, 'id' | 'updated_at'>
  ) => {
    // 1) 先创建项目骨架（只写 name/description/tech_stack）
    const created = await createProject({
      name: projectData.name ?? '导入项目',
      description: projectData.description || undefined,
      tech_stack: projectData.tech_stack ?? [],
    });

    // 2) 构造完整项目树（含旅程、故事）并写入。
    //    TOML 中的 UJ-001/US-001 等 ID 是文档语义编号，非全局唯一：
    //    直接入库会与其它已导入项目的 ID 冲突（主键重复）。
    //    因此为每个旅程/故事生成全局唯一 ID（保留语义前缀便于识别）。
    const now = new Date().toISOString();
    const fullProject: Project = {
      id: created.id,
      name: projectData.name ?? '导入项目',
      description: projectData.description,
      created_at: now,
      updated_at: now,
      user_journeys: (projectData.user_journeys ?? []).map(
        (journey, journeyIndex) => {
          const newJourneyId = `UJ-${nanoid(8)}`;
          return {
            id: newJourneyId,
            name: journey.name,
            description: journey.description,
            persona: journey.persona,
            project_id: created.id,
            order: journey.order ?? journeyIndex,
            created_at: now,
            updated_at: now,
            stories: (journey.stories ?? []).map((story, storyIndex) => ({
              id: `US-${nanoid(8)}`,
              journey_id: newJourneyId,
              title: story.title,
              description: story.description,
              priority: story.priority as Priority,
              estimation: story.estimation,
              acceptance_criteria: story.acceptance_criteria.map(
                (criterion) => criterion.description
              ),
              tags: story.tags ?? [],
              tasks: [],
              order: storyIndex,
              status: story.status ?? 'backlog',
              created_at: now,
              updated_at: now,
            })),
          };
        }
      ),
      metadata: {
        tech_stack: projectData.tech_stack ?? [],
        version: projectData.version ?? '1.0.0',
        tags: [],
      },
      settings: {
        auto_save: true,
        display_preferences: {
          show_priority_colors: true,
          show_estimation: true,
          default_view: 'map',
        },
      },
    };

    if (fullProject.user_journeys.length > 0) {
      await saveFullProject({ project: fullProject });
    }
    setShowImportDialog(false);
    navigate({ to: `/projects/$projectId`, params: { projectId: created.id } });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">项目管理</h1>
          <p className="mt-1 text-muted-foreground">
            管理您的产品路线图和用户故事
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" />
            导入 TOML
          </Button>
          <Button onClick={handleCreateClick}>
            <Plus className="mr-2 h-4 w-4" />
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


