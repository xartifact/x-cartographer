/**
 * localStorage 工具函数
 * 提供类型安全的 localStorage 操作
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('localStorage');

/**
 * 保存数据到 localStorage
 */
export function saveToLocalStorage<T>(key: string, data: T): void {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
  } catch (error) {
    log.error('localStorage.save.failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to save data');
  }
}

/**
 * 从 localStorage 读取数据
 */
export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const serialized = localStorage.getItem(key);
    if (serialized === null) {
      return null;
    }
    return JSON.parse(serialized) as T;
  } catch (error) {
    log.error('localStorage.load.failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 从 localStorage 删除数据
 */
export function removeFromLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    log.error('localStorage.remove.failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 清空 localStorage
 */
export function clearLocalStorage(): void {
  try {
    localStorage.clear();
  } catch (error) {
    log.error('localStorage.clear.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 检查 localStorage 中是否存在某个键
 */
export function hasInLocalStorage(key: string): boolean {
  return localStorage.getItem(key) !== null;
}

/**
 * 获取 localStorage 使用情况（估算）
 */
export function getLocalStorageSize(): {
  used: number;
  usedFormatted: string;
} {
  let total = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        total += key.length + value.length;
      }
    }
  }

  // 转换为 KB
  const usedKB = total / 1024;
  const usedFormatted =
    usedKB < 1024
      ? `${usedKB.toFixed(2)} KB`
      : `${(usedKB / 1024).toFixed(2)} MB`;

  return {
    used: total,
    usedFormatted,
  };
}

/**
 * 导出所有 localStorage 数据
 */
export function exportLocalStorage(): Record<string, string> {
  const data: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    }
  }

  return data;
}

/**
 * 导入数据到 localStorage
 */
export function importToLocalStorage(data: Record<string, string>): void {
  Object.entries(data).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
}
