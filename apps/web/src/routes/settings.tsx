import { ApiTokenSettings } from '@/features/settings';

/**
 * 设置页（/settings）
 */
export function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-muted-foreground mt-1">
          管理 API Token（内置 AI 已移除，智能由外部 Agent 驱动）
        </p>
      </div>
      <ApiTokenSettings />
    </div>
  );
}
