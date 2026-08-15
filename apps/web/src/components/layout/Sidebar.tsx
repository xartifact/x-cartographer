'use client';

import { Link } from '@tanstack/react-router';
import { useLocation } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@xpm/ui';
import { cn } from '@/lib/utils';
import { SidebarProps, NavItem } from './types';

/**
 * 递归渲染导航项
 */
function NavItemContent({
  item,
  collapsed,
  currentPath,
}: {
  item: NavItem;
  collapsed: boolean;
  currentPath: string;
}) {
  const isActive = item.href === currentPath;

  if (item.children && item.children.length > 0) {
    // 有子菜单的项
    return (
      <div className="space-y-1">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground transition-colors',
            'hover:text-foreground hover:bg-muted/50 cursor-pointer'
          )}
        >
          {item.icon && (
            <item.icon className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && (
            <>
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
        </div>
        {!collapsed && (
          <div className="ml-4 pl-3 border-l space-y-1">
            {item.children.map((child) => (
              <NavItemContent
                key={child.id}
                item={child}
                collapsed={collapsed}
                currentPath={currentPath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // 没有子菜单的项
  if (!item.href || item.hidden) {
    return null;
  }

  return (
    <Link
      to={item.href}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        item.disabled && 'pointer-events-none opacity-50'
      )}
    >
      {item.icon && (
        <item.icon className="h-4 w-4 shrink-0" />
      )}
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

/**
 * 侧边栏组件
 */
export function Sidebar({
  items,
  collapsed = false,
  onCollapsedChange,
  footer,
}: SidebarProps) {
  const pathname = useLocation().pathname;

  const toggleCollapsed = () => {
    onCollapsedChange?.(!collapsed);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r bg-background transition-all duration-300',
        collapsed ? 'w-[70px]' : 'w-[240px]',
        'hidden md:flex flex-col'
      )}
    >
      {/* 侧边栏内容区 */}
      <div className="flex flex-col flex-1 overflow-y-auto py-4">
        {/* 收起按钮 */}
        <div className={cn(
          'flex items-center px-4 mb-4',
          collapsed ? 'justify-center' : 'justify-end'
        )}>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className={cn(collapsed && 'mx-auto')}
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 px-3 space-y-1">
          {items.map((item) => (
            <NavItemContent
              key={item.id}
              item={item}
              collapsed={collapsed}
              currentPath={pathname}
            />
          ))}
        </nav>

        {/* 底部自定义内容 */}
        {footer && (
          <div className="mt-auto px-3 py-4 border-t">
            {footer}
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * 移动端侧边栏覆盖层
 */
export function MobileSidebarOverlay({
  items,
  open,
  onClose,
  currentPath,
}: {
  items: NavItem[];
  open: boolean;
  onClose: () => void;
  currentPath: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 侧边栏内容 */}
      <div className="fixed inset-y-0 left-0 w-[280px] bg-background border-r p-4">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="font-semibold text-lg" onClick={onClose}>
            X-Cartographer
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="关闭菜单"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="space-y-1">
          {items.map((item) => (
            <div key={item.id} onClick={onClose}>
              <NavItemContent
                item={item}
                collapsed={false}
                currentPath={currentPath}
              />
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}