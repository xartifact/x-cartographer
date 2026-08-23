'use client';

/**
 * Onboarding 入口组件（TASK-083/084/085/086）
 *
 * 首访自动弹出欢迎向导；提供 createSample 回调以便在向导中一键创建示例项目。
 * 设置页通过 resetOnboarding 重新触发。
 */

import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { OnboardingWizard, ONBOARDING_STORAGE_KEY } from './onboarding-wizard';
import { createSampleProjectData } from './sample-project';
import { useCreateProject } from '@/lib/api/hooks';

interface OnboardingGateProps {
  /** 是否立即显示（首访自动触发或设置页重看） */
  forceOpen?: boolean;
}

export function OnboardingGate({ forceOpen = false }: OnboardingGateProps) {
  const [open, setOpen] = useState(forceOpen);
  const createProject = useCreateProject();
  const navigate = useNavigate();

  // 首访判定（TASK-086：跳过即不再展示）
  const shouldShow = useCallback(() => {
    if (forceOpen) return true;
    try {
      return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'true';
    } catch {
      return true;
    }
  }, [forceOpen]);

  // 渲染时检查是否需要显示
  if (!open && shouldShow()) {
    // 延迟到渲染后触发，避免在首轮 render 中 setState
    queueMicrotask(() => setOpen(true));
  }

  const handleComplete = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      // 忽略
    }
  }, []);

  const handleCreateSample = useCallback(async () => {
    const data = createSampleProjectData();
    const now = new Date().toISOString();
    const res = (await createProject.mutateAsync({
      name: data.name,
      description: data.description,
      tech_stack: data.metadata.tech_stack,
    })) as { success?: boolean; id?: string };
    if (res.id) {
      navigate({ to: '/projects/$projectId/story-map', params: { projectId: res.id } });
    }
  }, [createProject, navigate]);

  return (
    <OnboardingWizard
      open={open}
      onOpenChange={setOpen}
      onCreateSample={handleCreateSample}
      onComplete={handleComplete}
    />
  );
}

/** 设置页/帮助入口：重置首访标志并重新打开向导（TASK-086 重看） */
export function resetOnboarding(): void {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // 忽略
  }
}