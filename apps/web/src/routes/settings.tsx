import { LLMSettings } from '@/features/settings';



/**
 * 设置页（/settings）
 */
export function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-muted-foreground mt-1">
          管理应用配置和 AI 服务密钥
        </p>
      </div>

      <LLMSettings />
    </div>
  );
}
