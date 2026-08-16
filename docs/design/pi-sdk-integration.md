# Pi Agent SDK 集成方案：LLM 功能切换

> 状态: 待评审
> 目标: 将 gateway 的 LLM 调用层（需求分析/旅程生成/任务拆解）从原生 fetch（OpenAI/Anthropic API）切换为 Pi agent SDK（`@earendil-works/pi-coding-agent`）

## 1. 现状

```
apps/server/src/lib/llm.ts
├── getProviderConfig()      — 从 AppSettingsRepository 读 apiKey/baseURL/model（DB 持久化）
├── chatCompletion()         — 原生 fetch OpenAI/Anthropic（待替换为 Pi SDK）
├── generateJson<T>()        — chatCompletion + 宽松 JSON 解析 + zod 校验（保留）
├── parseJsonLoose()         — JSON5 + jsonrepair 容错（保留）
└── testConnection()         — 连接测试（待替换）

apps/server/src/routes/llm.ts — 3 个端点（analyze/generate-journey/decompose，保留）
apps/server/src/lib/prompts.ts — 6 个 prompt 模板（保留）
```

## 2. 目标架构

```
                    ┌─────────────────────────────────┐
HTTP /api/llm/* ──▶ │ routes/llm.ts（端点，不变）       │
                    │   └─ generateJson()（zod 校验）  │
                    │        └─ llm.ts 替换层          │
                    │             ├─ PiProviderAdapter │
                    │             │    createAgentSession
                    │             │    session.prompt()
                    │             │    finalMessage    │
                    │             └─ parseJsonLoose()  │
                    └─────────────────────────────────┘
                              │
                    Pi SDK（@earendil-works/pi-coding-agent）
                              │
                    x-herald provider（已有 key）或自定义 provider
```

## 3. SDK 用法（已调研确认）

```typescript
import { createAgentSession, ModelRuntime, SessionManager } from '@earendil-works/pi-coding-agent';

// 最小化
const modelRuntime = await ModelRuntime.create();
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});
await session.prompt('...'); // 返回 RunResult { finalMessage }

// 自定义 provider（复用现有 key 配置）
pi.registerProvider('x-herald', { baseUrl, apiKey, api: 'openai-completions', models: [...] });
```

关键点：
- `session.prompt()` 返回含 `finalMessage` 的结果（非流式，适合服务端同步调用）
- `SessionManager.inMemory()` — 无持久化，每次请求独立会话（符合当前无状态设计）
- `createAgentSession({ tools: [] })` — 禁用工具，纯文本生成（LLM 端点不需要 agent 工具）

## 3.5 Spike 验证结论（已完成）

在 `apps/server` 安装 SDK 后实测：
- `ModelRuntime.create()` ✅ 成功
- `createAgentSession({ sessionManager: inMemory, tools: [] })` ✅ 成功（session 完整构造）
- `session.prompt()` ✅ 调用链走到 provider 认证层（报"无 API key"系 x-llm-gateway 服务未启动的环境问题）

**结论**：SDK 调用链完整可用，仅依赖真实 AI provider（x-llm-gateway/x-herald 服务）就绪。集成时通过 `registerProvider`（`pi-coding-agent/core/model-registry`）注入服务配置即可。
```typescript
// Pi SDK 适配层：替代 chatCompletion
export interface PiAdapterConfig {
  provider: string;        // 'x-herald' 或自定义 id
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export async function piGenerateText(
  config: PiAdapterConfig,
  system: string,
  prompt: string,
): Promise<string> {
  const modelRuntime = await ModelRuntime.create();
  const { session } = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    modelRuntime,
    tools: [],            // 纯文本生成，无 agent 工具
  });
  const result = await session.prompt(`${system}\n\n${prompt}`);
  return extractText(result);  // 从 RunResult 取 finalMessage 文本
}
```

### 4.2 改造 `llm.ts`
- `chatCompletion()` 内部改为调 `piGenerateText()`（按 provider 配置）
- 保留 `generateJson()` / `parseJsonLoose()` / zod 校验（输出解析不变）
- `testConnection()` 改调 piGenerateText（"Say ok"）
- `getProviderConfig()` 扩展：读 Pi provider 配置（复用现有 llm_api_key_*/baseURL/model 或新增 pi_* 键）

### 4.3 provider 配置
- 方式 A（推荐）：**沿用现有设置**——DB 里的 `llm_api_key_{provider}` 传给 Pi 自定义 provider 注册
- 方式 B：新增 `pi` provider 类型（设置页加 Pi 卡片）

### 4.4 依赖
- `apps/server` 加 `@earendil-works/pi-coding-agent`（SDK）
- `@earendil-works/pi-ai`（若需 registerProvider）

### 4.5 兼容
- 前端 3 个端点（analyze/generate-journey/decompose）**不变**——返回结构同现状
- 设置页 LLM 配置**不变**（provider 选择保留，底层走 Pi）
- `testConnection` 行为保持（成功/失败提示）

## 5. 风险与权衡

| 风险 | 缓解 |
|---|---|
| SDK 依赖重（pi-coding-agent 含 agent 运行时） | tools:[] + inMemory 最小化；SDK 按需加载 |
| 每次请求创建 modelRuntime 开销 | 模块级单例复用 modelRuntime |
| Pi 模型输出格式不确定 | 保留 parseJsonLoose 三级容错 + zod 校验 |
| x-herald 与 OpenAI 协议差异 | 先用现 key 验证；不行则自定义 provider 映射 |
| SDK 版本稳定性 | 锁版本，先 spike 验证 3 个端点 |

## 6. 验收

1. `POST /api/llm/analyze-requirements` 走 Pi SDK 返回结构化结果（mock/真实 key）
2. 3 个端点 + testConnection 全通
3. 前端需求分析/旅程/拆解流程不回归（E2E/手工）
4. 设置页 provider 切换仍可用
5. 全量测试绿
