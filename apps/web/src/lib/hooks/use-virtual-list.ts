'use client';

/**
 * 轻量虚拟滚动 hook（TASK-089）
 *
 * 固定行高热卷动：只渲染可视窗口内的行，适合大量数据的列表。
 * 无外部依赖，滚动容器由调用方提供 ref。
 *
 * 用法：
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const { start, end, totalHeight, offsetY } = useVirtualList(
 *     items.length, containerRef, ROW_HEIGHT, OVERSCAN
 *   );
 *   // 渲染 items.slice(start, end)，容器高度 totalHeight，内容 translateY(offsetY)
 */

import { useRef, useState, useEffect, useCallback } from 'react';

interface VirtualListResult {
  /** 可视区起始索引 */
  start: number;
  /** 可视区结束索引（不含） */
  end: number;
  /** 容器总高度（px） */
  totalHeight: number;
  /** 内容偏移（px），用于 translateY */
  offsetY: number;
}

export function useVirtualList(
  itemCount: number,
  containerRef: React.RefObject<HTMLElement | null>,
  rowHeight: number,
  overscan = 5
): VirtualListResult {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const rafRef = useRef<number>(0);

  const update = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    setViewportHeight(el.clientHeight);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // 初始尺寸
    setScrollTop(el.scrollTop);
    setViewportHeight(el.clientHeight);

    const onScroll = () => {
      // rAF 节流，避免滚动时频繁 setState
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setScrollTop(el.scrollTop);
        setViewportHeight(el.clientHeight);
      });
    };

    // ResizeObserver 监听容器尺寸变化
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef]);

  const totalHeight = itemCount * rowHeight;

  const start = Math.max(
    0,
    Math.floor(scrollTop / rowHeight) - overscan
  );
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const end = Math.min(itemCount, start + visibleCount);
  const offsetY = start * rowHeight;

  return { start, end, totalHeight, offsetY };
}