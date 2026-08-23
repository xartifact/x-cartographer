'use client';

/**
 * 设置页（/settings）
 *
 * 提供 API Token 管理与「重新查看快速入门」入口（TASK-086）。
 */

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { ApiTokenSettings } from '@/features/settings';
import { Button } from '@x-cartographer/ui';
import { OnboardingWizard } from '@/features/onboarding';

export function SettingsPage() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-muted-foreground mt-1">
          管理 API Token（内置 AI 已移除，智能由外部 Agent 驱动）
        </p>
      </div>

      <div className="rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">快速入门</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            重新查看产品使用引导与示例项目
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowOnboarding(true)}
        >
          <BookOpen className="mr-1 h-4 w-4" />
          查看快速入门
        </Button>
      </div>

      <ApiTokenSettings />

      <OnboardingWizard
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
      />
    </div>
  );
}