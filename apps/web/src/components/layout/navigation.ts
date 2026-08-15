/**
 * 导航菜单数据结构
 */

import {
  LayoutDashboard,
  FolderKanban,
  Map,
  CheckSquare,
  Settings,
  ChevronRight,
  Home,
} from 'lucide-react';
import { NavItem } from './types';

/**
 * 主导航菜单配置（全局侧边栏）
 */
export const mainNavItems: NavItem[] = [
  {
    id: 'dashboard',
    label: '首页',
    href: '/',
    icon: Home,
  },
  {
    id: 'projects',
    label: '项目列表',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    id: 'story-map',
    label: '用户故事地图',
    href: '/projects',
    icon: Map,
    projectScoped: true,
  },
  {
    id: 'tasks',
    label: '任务看板',
    href: '/projects',
    icon: CheckSquare,
    projectScoped: true,
  },
  {
    id: 'settings',
    label: '设置',
    href: '/settings',
    icon: Settings,
  },
];

/**
 * 项目内导航菜单配置
 */
export const projectNavItems: NavItem[] = [
  {
    id: 'overview',
    label: '概览',
    href: '/projects/[id]',
    icon: LayoutDashboard,
  },
  {
    id: 'requirements',
    label: '需求分析',
    href: '/projects/[id]/requirements',
    icon: FolderKanban,
  },
  {
    id: 'story-map',
    label: '故事地图',
    href: '/projects/[id]/story-map',
    icon: Map,
  },
  {
    id: 'tasks',
    label: '任务',
    href: '/projects/[id]/tasks',
    icon: CheckSquare,
  },
  {
    id: 'data',
    label: '数据浏览器',
    href: '/projects/[id]/data',
    icon: ChevronRight,
  },
];

/**
 * 根据路径获取导航项
 */
export function getNavItemByPath(
  items: NavItem[],
  pathname: string
): NavItem | undefined {
  for (const item of items) {
    if (item.href === pathname) {
      return item;
    }
    if (item.children) {
      const found = getNavItemByPath(item.children, pathname);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * 检查路径是否匹配导航项
 * 支持动态路由参数匹配
 */
export function isPathMatch(href: string, pathname: string): boolean {
  if (!href || !pathname) return false;

  // 处理动态路由参数 [id]
  const pattern = href.replace(/\[([^\]]+)\]/g, '([^/]+)');
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(pathname);
}

/**
 * 获取当前激活的导航项
 */
export function getActiveNavItem(
  items: NavItem[],
  pathname: string
): NavItem | undefined {
  for (const item of items) {
    if (item.href && isPathMatch(item.href, pathname)) {
      return item;
    }
    if (item.children) {
      const found = getActiveNavItem(item.children, pathname);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * 面包屑配置生成器
 */
export interface BreadcrumbConfig {
  home?: {
    label: string;
    href?: string;
  };
  mappings: {
    [key: string]: {
      label: string;
      href?: string;
    } | string;
  };
}

/**
 * 根据路径生成面包屑
 */
export function generateBreadcrumbs(
  pathname: string,
  config: BreadcrumbConfig
): { label: string; href?: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: { label: string; href?: string }[] = [];

  // 添加首页
  if (config.home) {
    breadcrumbs.push({
      label: config.home.label,
      href: config.home.href || '/',
    });
  }

  // 逐个处理路径段
  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const mapping = config.mappings[currentPath];

    if (mapping) {
      breadcrumbs.push({
        label: typeof mapping === 'string' ? mapping : mapping.label,
        href: (typeof mapping === 'string' ? currentPath : mapping.href) || currentPath,
      });
    } else {
      // 默认使用路径段作为标签
      breadcrumbs.push({
        label: segment,
        href: currentPath,
      });
    }
  }

  return breadcrumbs;
}