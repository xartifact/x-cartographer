'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { Sidebar, MobileSidebarOverlay } from './Sidebar';
import { cn } from '@/lib/utils';
import { mainNavItems } from './navigation';
import { AppLayoutProps } from './types';

/**
 * AppLayout - 全局应用布局组件
 *
 * 包含：
 * - 顶部栏 (Header)
 * - 侧边栏 (Sidebar)
 * - 移动端适配
 * - 内容区域
 */
export function AppLayout({
  children,
  navItems,
  showSidebar = true,
  sidebarCollapsed: controlledCollapsed,
  mobileSidebarOpen: controlledMobileOpen,
  onMobileSidebarToggle,
}: AppLayoutProps) {
  // 使用默认导航项，避免从 Server Component 传递函数
  const navigationItems = navItems || mainNavItems;
  const pathname = usePathname();

  // 侧边栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(controlledCollapsed ?? false);

  // 移动端侧边栏打开状态
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(controlledMobileOpen ?? false);

  // 同步受控状态
  useEffect(() => {
    if (controlledCollapsed !== undefined) {
      setSidebarCollapsed(controlledCollapsed);
    }
  }, [controlledCollapsed]);

  useEffect(() => {
    if (controlledMobileOpen !== undefined) {
      setMobileSidebarOpen(controlledMobileOpen);
    }
  }, [controlledMobileOpen]);

  // 移动端侧边栏切换
  const toggleMobileSidebar = (open?: boolean) => {
    const newOpen = open ?? !mobileSidebarOpen;
    setMobileSidebarOpen(newOpen);
    onMobileSidebarToggle?.(newOpen);
  };

  // 检查是否是项目详情页面
  const isProjectPage = pathname?.startsWith('/projects/');

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部栏 */}
      <Header onMenuClick={() => toggleMobileSidebar()} />

      <div className="flex">
        {/* 侧边栏 - 桌面端 */}
        {showSidebar && !isProjectPage && (
          <Sidebar
            items={navigationItems}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
        )}

        {/* 移动端侧边栏覆盖层 */}
        {showSidebar && !isProjectPage && (
          <MobileSidebarOverlay
            items={navigationItems}
            open={mobileSidebarOpen}
            onClose={() => toggleMobileSidebar(false)}
            currentPath={pathname || ''}
          />
        )}

        {/* 主内容区 */}
        <main
          className={cn(
            'flex-1 min-h-[calc(100vh-3.5rem)] transition-all duration-300',
            showSidebar && !isProjectPage
              ? sidebarCollapsed
                ? 'md:ml-[70px]'
                : 'md:ml-[240px]'
              : 'ml-0'
          )}
        >
          <div className="container mx-auto p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * 纯内容布局（无侧边栏）
 */
export function ContentLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-h-screen bg-background', className)}>
      <Header />
      <main className="pt-14">
        <div className="container mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * 仪表板布局（左侧边栏 + 右侧内容）
 */
export function DashboardLayout({
  children,
  navItems,
  sidebarCollapsed,
}: {
  children: React.ReactNode;
  navItems?: AppLayoutProps['navItems'];
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
}) {
  return (
    <AppLayout
      navItems={navItems}
      sidebarCollapsed={sidebarCollapsed}
      onMobileSidebarToggle={() => {}}
      showSidebar
    >
      {children}
    </AppLayout>
  );
}