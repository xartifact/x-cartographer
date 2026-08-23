'use client';

/**
 * 快速入门向导（TASK-083 组件 / TASK-084 内容 / TASK-085 示例模板 / TASK-086 跳过重看）
 *
 * 首次访问时以对话框形式引导新用户了解核心功能：
 * - 4 步介绍：故事地图、任务拆解、状态追踪、排期规划
 * - 提供「创建示例项目」快捷入口（示例项目模板）
 * - 支持跳过（首次不再展示）与重新查看（设置页入口）
 */

import { useState, useCallback } from 'react';
import {
  Map,
  CheckSquare,
  ListChecks,
  CalendarRange,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@x-cartographer/ui';
import { Button } from '@x-cartographer/ui';

export const ONBOARDING_STORAGE_KEY = 'xcart-onboarding-done';

/** 向导步骤内容（TASK-084） */
const WIZARD_STEPS = [
  {
    icon: Map,
    title: '创建故事地图',
    description:
      '以用户旅程为维度组织用户故事，拖拽调整优先级与顺序，可视化产品全貌。',
  },
  {
    icon: CheckSquare,
    title: '拆解开发任务',
    description:
      '将用户故事拆解为可执行任务，设置优先级、工时估算与任务依赖关系。',
  },
  {
    icon: ListChecks,
    title: '追踪任务状态',
    description:
      '通过列表、看板、任务三视图管理进度，批量更新状态并查看变更历史。',
  },
  {
    icon: CalendarRange,
    title: '规划版本排期',
    description:
      '创建里程碑版本，将故事排入交付计划，用 Roadmap 泳道视图衡量容量。',
  },
];

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 创建示例项目（TASK-085） */
  onCreateSample?: () => Promise<void>;
  /** 全部跳过标记（写入 localStorage） */
  onComplete?: () => void;
}

export function OnboardingWizard({
  open,
  onOpenChange,
  onCreateSample,
  onComplete,
}: OnboardingWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [creating, setCreating] = useState(false);

  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  const handleClose = useCallback(() => {
    setStepIndex(0);
    onComplete?.();
    onOpenChange(false);
  }, [onComplete, onOpenChange]);

  const handleCreateSample = useCallback(async () => {
    if (!onCreateSample) return;
    setCreating(true);
    try {
      await onCreateSample();
      handleClose();
    } finally {
      setCreating(false);
    }
  }, [onCreateSample, handleClose]);

  const current = WIZARD_STEPS[stepIndex];
  const CurrentIcon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) handleClose();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            欢迎使用 X-Cartographer
          </DialogTitle>
        </DialogHeader>

        <div className="py-3">
          {/* 步骤内容 */}
          <div className="flex items-start gap-4 rounded-lg border bg-muted/40 p-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
              <CurrentIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{current.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {current.description}
              </p>
            </div>
          </div>

          {/* 步骤指示器 */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {WIZARD_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === stepIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted'
                }`}
              />
            ))}
          </div>

          {/* 示例项目模板（TASK-085） */}
          {isLastStep && onCreateSample && (
            <div className="mt-4 rounded-lg border border-dashed p-3 text-center">
              <p className="text-xs text-muted-foreground mb-2">
                想先看看示例？一键创建演示项目
              </p>
              <Button
                size="sm"
                onClick={handleCreateSample}
                disabled={creating}
              >
                {creating ? '创建中...' : '创建示例项目'}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="justify-between">
          {/* 跳过（TASK-086） */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-muted-foreground"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            跳过
          </Button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStepIndex((i) => i - 1)}
              >
                上一步
              </Button>
            )}
            <Button size="sm" onClick={() => {
              if (isLastStep) {
                handleClose();
              } else {
                setStepIndex((i) => i + 1);
              }
            }}>
              {isLastStep ? '开始使用' : '下一步'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}