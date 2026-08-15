'use client';

import { Link } from '@tanstack/react-router';
import { Search, Bell, Menu, User, Settings, LogOut } from 'lucide-react';
import { Button } from '@xpm/ui';
import { Input } from '@xpm/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@xpm/ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@xpm/ui';
import { cn } from '@/lib/utils';
import { HeaderProps } from './types';

interface HeaderLogoProps {
  href?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Logo 组件
 */
function HeaderLogo({ href = '/', children, className }: HeaderLogoProps) {
  return (
    <Link
      to={href}
      className={cn(
        'flex items-center gap-2 font-semibold text-lg transition-colors hover:text-primary',
        className
      )}
    >
      {children || <span>X-Cartographer</span>}
    </Link>
  );
}

/**
 * 顶部栏组件
 */
export function Header({
  logoHref = '/',
  user,
  searchPlaceholder = '搜索...',
  notificationCount = 0,
  logo,
  actions,
  onMenuClick,
}: HeaderProps) {

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 md:px-6">
        {/* 移动端菜单按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 md:hidden"
          onClick={onMenuClick}
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo */}
        <div className="flex items-center gap-4">
          <HeaderLogo href={logoHref}>
            {logo || (
              <span className="hidden sm:inline">X-Cartographer</span>
            )}
          </HeaderLogo>
        </div>

        {/* 搜索框 - 桌面端 */}
        <div className="flex-1 flex justify-center px-4 md:px-8">
          <div className="relative w-full max-w-md hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-4 bg-muted/50 focus:bg-background"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2">
          {/* 移动端搜索按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="搜索"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* 通知按钮 */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>通知</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* 用户菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 rounded-full"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.name || '用户'}</p>
                  <p className="text-xs text-muted-foreground">
                    {user?.email || 'user@example.com'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/profile" className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  个人资料
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  设置
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 自定义操作 */}
          {actions}

          {/* 主题切换 - 可以放在这里 */}
          {/* <ThemeToggle /> */}
        </div>
      </div>
    </header>
  );
}