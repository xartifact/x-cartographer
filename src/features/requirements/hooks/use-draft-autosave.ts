/**
 * 草稿自动保存 Hook
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRequirementStore } from '../stores/requirement-store';
import { createLogger } from '@/lib/logger';

const log = createLogger('draftAutosave');

/**
 * 自动保存配置
 */
const AUTOSAVE_DELAY = 1000; // 1秒防抖
const STORAGE_KEY_TEMPLATE = 'requirement-draft-';

/**
 * 获取存储键
 */
function getStorageKey(projectId: string): string {
  return `${STORAGE_KEY_TEMPLATE}${projectId}`;
}

/**
 * 草稿数据接口
 */
interface DraftData {
  text: string;
  savedAt: number;
}

/**
 * 草稿自动保存 Hook
 */
export function useDraftAutosave(projectId: string | undefined) {
  const { inputText, setInputText } = useRequirementStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const projectIdRef = useRef(projectId);

  // 更新项目 ID 引用
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  // 从本地存储加载草稿
  useEffect(() => {
    if (!projectId) return;

    const storageKey = getStorageKey(projectId);
    const savedDraft = localStorage.getItem(storageKey);

    if (savedDraft) {
      try {
        const draft: DraftData = JSON.parse(savedDraft);

        // 只有当草稿不是空的且与当前输入不同时才加载
        if (draft.text && draft.text !== inputText) {
          setInputText(draft.text);
        }
      } catch {
        // 解析失败，忽略错误
        log.warn('draft.parse.failed');
      }
    }
  }, [projectId, setInputText, inputText]);

  // 保存草稿到本地存储
  const saveDraft = useCallback(() => {
    if (!projectIdRef.current || !inputText.trim()) return;

    const storageKey = getStorageKey(projectIdRef.current);
    const draft: DraftData = {
      text: inputText,
      savedAt: Date.now(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      log.warn('draft.save.failed');
    }
  }, [inputText]);

  // 清理函数
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // 监听输入变化，触发自动保存
  useEffect(() => {
    // 清除之前的定时器
    cleanup();

    // 设置新的定时器
    timeoutRef.current = setTimeout(() => {
      saveDraft();
    }, AUTOSAVE_DELAY);

    // 清理函数
    return cleanup;
  }, [inputText, saveDraft, cleanup]);

  // 获取最后保存时间
  const getLastSavedTime = useCallback((): string | null => {
    if (!projectId) return null;

    const storageKey = getStorageKey(projectId);
    const savedDraft = localStorage.getItem(storageKey);

    if (savedDraft) {
      try {
        const draft: DraftData = JSON.parse(savedDraft);
        return new Date(draft.savedAt).toLocaleString('zh-CN');
      } catch {
        return null;
      }
    }

    return null;
  }, [projectId]);

  // 手动保存草稿
  const manualSave = useCallback(() => {
    saveDraft();
  }, [saveDraft]);

  // 清除草稿
  const clearDraft = useCallback(() => {
    if (!projectId) return;

    const storageKey = getStorageKey(projectId);
    localStorage.removeItem(storageKey);
    setInputText('');
  }, [projectId, setInputText]);

  return {
    /** 最后保存时间 */
    lastSavedTime: getLastSavedTime(),
    /** 手动保存 */
    saveDraft: manualSave,
    /** 清除草稿 */
    clearDraft,
    /** 草稿是否为空 */
    isEmpty: !inputText.trim(),
  };
}
