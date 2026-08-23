'use client';

/**
 * 键盘快捷键 hook（TASK-090）
 *
 * 提供全局快捷键注册：在组件挂载期间监听 keydown，
 * 命中组合键时触发回调。支持修饰键（ctrl/meta/shift/alt）组合。
 *
 * 用法：
 *   useHotkeys('mod+s', handler)         // Cmd/Ctrl + S
 *   useHotkeys('n', handler, { enabled: !dialogOpen })
 */

import { useEffect } from 'react';

export type HotkeyCombination = string;

interface UseHotkeysOptions {
  /** 是否启用（默认 true） */
  enabled?: boolean;
  /** 目标元素（默认 window） */
  target?: Window | HTMLElement | null;
}

function parseCombination(combo: string): {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  usesMod: boolean;
} {
  const parts = combo.toLowerCase().split('+');
  const key = parts[parts.length - 1] ?? '';
  const usesMod = parts.includes('mod');
  return {
    key,
    ctrl: usesMod || parts.includes('ctrl'),
    meta: usesMod || parts.includes('meta'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    usesMod,
  };
}

/** 统一 'mod' 为当前平台的主修饰键（Mac: Meta, 其他: Ctrl） */
function isPlatformMod(e: KeyboardEvent): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? e.metaKey
    : e.ctrlKey;
}

export function useHotkeys(
  combination: HotkeyCombination,
  handler: (e: KeyboardEvent) => void,
  options: UseHotkeysOptions = {}
) {
  const { enabled = true, target } = options;

  useEffect(() => {
    if (!enabled || !combination) return;

    const parsed = parseCombination(combination);

    const onKeyDown = (e: KeyboardEvent) => {
      const keyMatches = (e.key ?? '').toLowerCase() === parsed.key;
      if (!keyMatches) return;

      const modOk = parsed.usesMod
        ? isPlatformMod(e)
        : !e.ctrlKey && !e.metaKey;
      const shiftOk = parsed.shift === e.shiftKey;
      const altOk = parsed.alt === e.altKey;

      if (modOk && shiftOk && altOk) {
        e.preventDefault();
        handler(e);
      }
    };

    const el = target ?? window;
    const listener = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        onKeyDown(e);
      }
    };
    el.addEventListener('keydown', listener);
    return () => el.removeEventListener('keydown', listener);
  }, [combination, handler, enabled, target]);
}