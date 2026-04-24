/**
 * 应用设置页面
 *
 * 路由: /settings
 */

import { LLMSettings } from '@/features/settings';

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-muted-foreground mt-1">管理应用配置和 AI 服务密钥</p>
      </div>

      {/* LLM 配置 */}
      <LLMSettings />
    </div>
  );
}
