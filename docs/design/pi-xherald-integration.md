# Pi SDK + X-Herald 自动适配集成方案

> 状态: 已批准（2026-08-16）
> 前置: x-llm-gateway 已更名 x-herald，服务地址 `100.80.110.125:5005`

## 1. 目标

1. LLM 调用层切换到 Pi agent SDK（`@earendil-works/pi-coding-agent`）
2. **自动适配 x-herald 网关**：动态发现模型、OpenAI 兼容协议、配置可管理
3. 配置走设置页（DB 持久化），非 pi 的 auth.json

## 2. 参考：pi 的 x-herald extension 机制（已读源码）

`~/.pi/agent/extensions/x-herald/` 的适配模式：
- **配置解析**（config.ts）：models.json → auth.json → env → 默认 `localhost:5005/api/v1`
- **模型发现**（gateway.ts）：`fetchGatewayModels` → `GET {baseUrl}/models`（Bearer key）→ 映射为 ProviderModelConfig
- **动态刷新**：`refreshModels` hook（模型选择器打开时重新拉取）
- **provider 注册**（entry.ts）：`pi.registerProvider(PROVIDER_ID, { baseUrl, apiKey, api: 'openai-completions', models, refreshModels })`

## 3. 项目内实现（把 extension 机制搬进 gateway）

### 3.1 新增 provider 类型
```typescript
// packages/shared/src/types/common.ts
export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  X_HERALD = 'x-herald',   // 新增
}
```

### 3.2 `apps/server/src/lib/x-herald.ts`（自动适配器）
复制 extension 核心逻辑：
- `discoverModels(baseUrl, apiKey)` — GET /models → 模型列表（含 contextWindow/maxTokens/reasoning/vision）
- `toPiModel()` — 网关模型条目 → Pi ProviderModelConfig（含 compat/headers）
- `buildXHeraldProvider({ baseUrl, apiKey, models })` — 生成 registerProvider 载荷

### 3.3 `apps/server/src/lib/pi-adapter.ts`（Pi SDK 调用层）
```typescript
export async function piGenerateText(config, system, prompt): Promise<string> {
  // 1. 注册/复用 provider（含动态模型发现）
  // 2. createAgentSession({ model, tools: [], sessionManager: inMemory })
  // 3. session.prompt(system + prompt) → finalMessage 文本
}
```

### 3.4 `apps/server/src/lib/llm.ts` 改造
- `chatCompletion()` 分支：`provider === X_HERALD` → 走 pi-adapter；否则保留原 fetch（兼容 OpenAI/Anthropic）
- `getProviderConfig()` 支持 x-herald（baseUrl 默认 `http://100.80.110.125:5005/api/v1`）
- `testConnection()` 适配 x-herald

### 3.5 配置页（设置页 + settings 路由）
- 设置页加 **X-Herald 卡片**（provider 选择 + API key + baseURL + model）
- settings 路由 providerSchema 扩展 x-herald
- 存储沿用 `llm_api_key_x-herald` / `llm_base_url_x-herald` / `llm_model_x-herald`（DB）

### 3.6 模型动态适配
- 每次调用前 `discoverModels()` 拉最新模型（轻量 GET）
- model 未指定时用网关返回的第一个可用模型
- 支持网关模型列表变化（新模型自动可用）

## 4. 调用流程

```
设置页存 key/baseURL → DB (app_settings)
        ↓
POST /api/llm/analyze-requirements
        ↓
llm.ts generateJson() → chatCompletion(provider=X_HERALD)
        ↓
pi-adapter: discoverModels(100.80.110.125:5005) → 选模型
        ↓
createAgentSession + prompt → finalMessage
        ↓
parseJsonLoose + zod 校验 → 结构化结果
```

## 5. 实施步骤

1. `packages/shared`：LLMProvider 加 X_HERALD
2. `apps/server/src/lib/x-herald.ts`：适配器（模型发现 + 映射）
3. `apps/server/src/lib/pi-adapter.ts`：Pi SDK 调用
4. `apps/server/src/lib/llm.ts`：chatCompletion 分支
5. `apps/server/src/routes/settings.ts` + `llm.ts`：provider schema 扩展
6. `apps/web` 设置页：X-Herald 卡片
7. 测试：x-herald 端点连通 + 3 个 LLM 端点

## 6. 风险

| 风险 | 缓解 |
|---|---|
| 100.80.110.125 需真实 key | 用户配置页填；UNAUTHORIZED 时提示 |
| Pi SDK 每次 createAgentSession 开销 | modelRuntime 单例复用；session 复用 |
| 网关模型变化 | 每次调用 discoverModels（轻量） |
| 与现有 OpenAI/Anthropic 并存 | chatCompletion 按 provider 分支，互不影响 |
