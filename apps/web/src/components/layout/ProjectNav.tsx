'use client';

import { Link, useLocation } from '@tanstack/react-router';
import {
  ArrowLeft,
  LayoutDashboard,
  Map,
  CheckSquare,
  Calendar,
  Database,
  Users,
  Footprints,
  FileText,
  Boxes,
} from 'lucide-react';
import { Button } from '@x-cartographer/ui';
import { cn } from '@/lib/utils';
import { ProjectNavProps } from './types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@x-cartographer/ui';

// 默认产品内导航项配置
const defaultProjectNavItems: ProjectNavProps['items'] = [
  {
    id: 'overview',
    label: '概览',
    href: '/products/[id]',
    icon: LayoutDashboard,
  },
  {
    id: 'story-map',
    label: '故事地图',
    href: '/products/[id]/story-map',
    icon: Map,
  },
  {
    id: 'journeys',
    label: '活动管理',
    href: '/products/[id]/journeys',
    icon: Users,
  },
  {
    id: 'user-tasks',
    label: '用户任务',
    href: '/products/[id]/user-tasks',
    icon: Footprints,
  },
  {
    id: 'stories',
    label: '故事管理',
    href: '/products/[id]/stories',
    icon: FileText,
  },
  {
    id: 'tasks',
    label: '任务',
    href: '/products/[id]/tasks',
    icon: CheckSquare,
  },
  {
    id: 'roadmap',
    label: '排期',
    href: '/products/[id]/roadmap',
    icon: Calendar,
  },
  {
    id: 'data',
    label: '数据',
    href: '/products/[id]/data',
    icon: Database,
  },
  {
    id: 'modules',
    label: '模块',
    href: '/products/[id]/modules',
    icon: Boxes,
  },
];

/**
 * 产品内导航组件
 *
 * 提供产品详情页面的标签页式导航，包括：
 * - 返回产品列表按钮
 * - 产品名称显示
 * - 产品内各功能页面的标签页导航
 * - 额外操作按钮
 */
export function ProjectNav({
  projectId,
  projectName,
  currentPath,
  items = defaultProjectNavItems,
  backHref = '/products',
  actions,
}: ProjectNavProps) {
  const pathname = (useLocation().pathname || currentPath || '');
  // 动态替换路径参数 [id] 为实际的 projectId
  const normalizeHref = (href: string | undefined): string => {
    if (!href) return '';
    return href.replace('[id]', projectId);
  };

  // 检查路径是否匹配
  const isActive = (itemHref: string | undefined): boolean => {
    if (!itemHref) return false;
    const normalizedHref = normalizeHref(itemHref);
    if (!normalizedHref) return false;

    // 概览页面（无子路径）需要精确匹配
    const isOverview = !normalizedHref.includes('/', '/products/'.length + 1);

    if (isOverview) {
      // 概览：精确匹配 /projects/xxx，不匹配子路径
      return pathname === normalizedHref;
    }

    // 其他页面：前缀匹配
    return pathname.startsWith(normalizedHref);
  };

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* 返回按钮和产品名称 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="h-8 w-8"
              >
                <Link to={backHref} aria-label="返回产品列表">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>返回产品列表</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            产品
          </span>
          <span className="text-muted-foreground hidden sm:inline">/</span>
          <h1 className="text-lg font-semibold truncate">
            {projectName || `产品 ${projectId}`}
          </h1>
        </div>

        {/* 额外操作 */}
        {actions && (
          <div className="ml-auto flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* 标签页导航 */}
      <nav className="flex items-center gap-1 px-4 overflow-x-auto">
        {items?.map((item) => {
          if (item.hidden) return null;

          const href = normalizeHref(item.href);
          const active = isActive(href);

          return (
            <Link
              key={item.href}
              to={href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
                active
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground hover:text-foreground border-transparent hover:border-muted-foreground/30'
              )}
            >
              {item.icon && (
                <item.icon className="h-4 w-4" />
              )}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}