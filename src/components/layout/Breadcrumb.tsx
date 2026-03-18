'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BreadcrumbProps } from './types';

/**
 * 面包屑导航组件
 */
export function Breadcrumb({
  items,
  separator = <ChevronRight className="h-4 w-4 text-muted-foreground" />,
}: BreadcrumbProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="面包屑导航" className="text-sm">
      <ol className="flex items-center gap-1 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isFirst = index === 0;

          return (
            <li key={index} className="flex items-center gap-1">
              {/* 首页图标 */}
              {isFirst && items.length > 1 && (
                <Link
                  href={item.href || '/'}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Home className="h-4 w-4" />
                </Link>
              )}

              {/* 普通项 */}
              {!isFirst && (
                <>
                  <span className="text-muted-foreground">{separator}</span>
                  {isLast || item.disabled ? (
                    <span
                      className={cn(
                        'px-1',
                        isLast && 'font-medium text-foreground',
                        item.disabled && 'text-muted-foreground cursor-not-allowed'
                      )}
                    >
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      href={item.href || '#'}
                      className="text-muted-foreground hover:text-foreground transition-colors px-1"
                    >
                      {item.label}
                    </Link>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * 简单的面包屑生成工具函数
 * 根据路径自动生成面包屑
 */
export function createBreadcrumbs(
  pathname: string,
  labels?: { [key: string]: string }
): { label: string; href?: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: { label: string; href?: string }[] = [];

  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`;
    const label = labels?.[currentPath] || segments[i];

    // 最后一项不添加链接
    const href = i === segments.length - 1 ? undefined : currentPath;

    breadcrumbs.push({ label, href });
  }

  return breadcrumbs;
}