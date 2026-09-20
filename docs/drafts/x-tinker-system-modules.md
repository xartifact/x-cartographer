# x-tinker system_modules 草稿

**Product**: `PROD-004`（x-tinker，自愈流水线）
**调查方式**：通读本地代码仓库 `/Users/binzhan/Workspaces/github/xartifact/x-tinker`（apps/server、apps/ui、packages/{shared,sdk,core,db}、Dockerfile、docker-compose.yml、.github/workflows/ci.yml，含 HEAD `c00d53f` multi-project 最新状态）；并用恢复后的 gateway :8787 核对全部 29 条 story（每条已逐条比对归属）。
**约束遵守**：只读调查，未写库（GET 之外零请求）；模块划分按架构职责边界，非目录映射。

---

## x-tinker

**架构概览**：x-tinker 是「错误上报 → 自动修复 → 验证 → 交付」的自愈流水线。被监控项目集成 SDK 捕获运行时异常上报；服务端接收事件、按项目配置路由，读取错误位置源码后委托 Coding Agent（或直接 LLM）产出补丁，验证通过后提交推送特性分支；Web UI 提供配置管理与修复历史。部署形态为单容器自托管（Docker + CI 自动发布）。

**模块清单**（9 个）：

| slug | name | path | responsibility | depends_on |
|---|---|---|---|---|
| config | 配置与数据契约 | packages/shared | 全系统数据契约与配置模型：ErrorEvent/FixPatch/FixResult/AgentConnection 类型、validateErrorEvent 校验、多项目 AppConfig 模型（含 legacy 单项目迁移）、`.x-tinker/config.json` 读写 | — |
| sdk-reporter | 错误上报 SDK | packages/sdk | 宿主应用侧错误捕获与上报：全局 uncaught/unhandledrejection 钩子（Node/Bun/浏览器）、Hono 框架错误中间件适配器、请求上下文元数据注入（path/method/requestId）、stack trace 解析提取 top frame、ErrorEvent 构建与 HTTP 上报 | config |
| event-ingest | 事件接入服务 | apps/server/src/routes, apps/server/src/index | 服务端事件入口：POST /api/events 校验与规范化、即时持久化后异步触发修复流水线（202 accepted）、/health 探活、静态资源与 SPA fallback 托管（serve.ts）、CORS/日志中间件 | config, event-store, fix-pipeline |
| fix-pipeline | 修复流水线 | apps/server/src/pipeline | 修复编排核心（7 步）：按 projectId 解析项目配置（strict/lenient 双策略）→ 读取错误位置源码并做行号标注 → 分派 Agent/LLM 模式 → 应用补丁 → 运行 verifyCommand 验证 → git 提交推送 auto-fix/* 特性分支 → 修复结果记录与状态流转 | config, agent-integration, llm-core, event-store |
| agent-integration | Coding Agent 集成 | packages/core/src/agent-*, packages/core/src/providers/*-agent.ts | Coding Agent 抽象与适配：AgentProvider 接口、注册表与 fixWithAgent 门面、ACP 协议接入（@agentclientprotocol/sdk ndJsonStream）、Claude Code / OpenCode CLI 子进程 Provider；规划中：pi（pi --mode rpc JSONL）/ omp 一等 Provider | config |
| llm-core | LLM 抽象与补丁生成 | packages/core/src/client.ts, packages/core/src/patch-generator.ts, packages/core/src/providers/{openai,anthropic,mock}.ts | 模型无关 LLM 调用层：LLMClient + LLMProvider 注册表（openai/anthropic/mock，可 registerProvider 扩展）、修复补丁生成（prompt 构建 → 调用 → 解析 unified diff 为 FixPatch） | config |
| event-store | 事件持久化 | packages/db | 嵌入式存储：PGlite + Drizzle 自动建表（events 含 raw_event jsonb、fixes 含 status/diff/commit_sha）；供接入、流水线、查询 API 共用 | config |
| web-console | 管理控制台 | apps/ui, apps/server/src/trpc | 配置与可观测前端：React + TanStack Router + shadcn/ui；tRPC 路由（appConfig 读写、projects 多项目 CRUD、events 修复历史查询）承载 API 层；配置页表单编排（Agent/LLM/Repo/Server/多项目）、Fix History 状态展示 | config, event-store |
| delivery | 交付与部署 | Dockerfile, docker-compose.yml, .github/workflows | 构建发布与自托管运行时：Docker 多阶段构建（UI 构建 → runner）、数据卷与源码只读挂载、健康检查；CI 自动发布（SDK/shared 双注册表 GitHub Packages + npm）、镜像多架构构建、x99 自托管部署 | config, web-console |

**depends_on 说明**：全部指向本目录内的 slug（`config` ≡ packages/shared，`event-store` ≡ packages/db），不含目录外的名字，可直接通过 `findMissingIds` 悬空引用校验。`delivery` 的依赖是发布管道依赖（部署消费 web-console 构建产物与 config 约定），非代码 import。

**划分依据**：
- **sdk-reporter 与 event-ingest 分开**：二者是不同信任域上的不同职责——SDK 跑在被监控项目 A 内（捕获、注入、解析 stack、上报），ingest 跑在 x-tinker 服务端（校验、落库、触发）。story 中「SDK 捕获/注入/解析 top frame/Hono 中间件」四条全是 SDK 侧，「POST /api/events 接收校验」是服务端侧，边界与代码位置都清晰。
- **fix-pipeline 与 agent-integration / llm-core 分开**：pipeline 是编排者（决定读什么、走哪条模式、验证、提交、记录），agent-integration 与 llm-core 是两种可替换的「产出 FixPatch」执行器。pipeline/index.ts 显式 `agentProvider !== "none"` 分叉正对应这条接口边界；「验证修复结果」「自动提交推送」「结果状态流转」是编排职责，不因执行器不同而改变。
- **agent-integration 与 llm-core 分开**：shared/types.ts 注释明确二者语义不同——AgentConnection（代码修改，ACP/A2A）vs LLMConfig（非编码任务），provider 注册表也是两套（AGENT_REGISTRY vs PROVIDER_REGISTRY）。pi/omp story 落 agent-integration；LLMClient story 落 llm-core。
- **config 单列**：多项目配置模型升级、legacy 迁移、config.json 持久化是横切契约（pipeline 靠它路由，web-console 靠它读写，delivery 靠它约定挂载），一句话职责「定义并持久化全系统数据契约与配置模型」。stories 1/10（多项目模型、config.json）归此。
- **web-console 吸收 tRPC API 层**：server 端 tRPC router 纯粹服务于 UI 的配置读写与历史查询，与面向外部 SDK 的 event-ingest（HTTP 数据面入口）受众不同，故归入控制台模块而非事件接入。这也让「事件与修复历史查询 API」「Fix History 展示」「配置表单」各归其位。
- **物理位置仅作佐证**：如 agent-integration 物理上在 packages/core/providers 下，与 llm-core 的 openai/anthropic provider 职责无关（编码代理子进程 vs API 协议），故按职责切开而非目录合并。

**工程治理类 Story 映射**（29/29 全覆盖；按 domain-model.md §2.5，非用户价值类工作建议转 DevTask 挂下表模块）：

| # | Story (id 前 8 位) | 模块 slug | 备注 |
|---|---|---|---|
| 1 | 配置模型从单项目升级为多项目列表 (AcQ6bFkf) | config | 类型 + legacy 迁移 |
| 2 | 事件与修复历史查询 API (wh52vvPW) | web-console | tRPC events.list/get |
| 3 | 数据持久化与项目 A 源码挂载 (nx0nZpzR) | delivery | 卷挂载，非模块代码 |
| 4 | tRPC 配置读写 API (Jwfg264L) | web-console | appConfig.get/save |
| 5 | Agent/LLM/Repo/Server 配置表单 (4PmuKagw) | web-console | 4 个表单组件 |
| 6 | 多项目管理 API 与 UI (OwN6qe0l) | web-console | projectsRouter + ProjectsSection |
| 7 | POST /api/events 接收错误事件并校验 (brdAl0Hr) | event-ingest | routes/pipeline.ts |
| 8 | 事件与修复结果持久化到 PGlite (7sozWYM7) | event-store | recordEvent/recordFix → packages/db |
| 9 | 事件按 projectId 路由到对应项目配置 (x2JeEFjs) | fix-pipeline | runPipeline 路由策略 |
| 10 | 应用配置持久化到 .x-tinker/config.json (Z792YdlX) | config | config-store.ts |
| 11 | Docker 多阶段构建与容器化部署 (Md0CkMFV) | delivery | Dockerfile + compose |
| 12 | 配置页表单编排与保存 (H9mVqdBn) | web-console | pages/config.tsx |
| 13 | 修复自动提交并推送特性分支 (1-KM01_6) | fix-pipeline | commit.ts |
| 14 | 修复流水线读取错误位置源码 (FF00_NbL) | fix-pipeline | read-source.ts |
| 15 | Agent 模式委托 ACP/A2A Coding Agent 修复 (IXs3QMIH) | fix-pipeline | 编排侧分派（Agent 执行侧见 #24/#22/#28） |
| 16 | 验证修复结果 (nqwpDEnC) | fix-pipeline | verify.ts |
| 17 | 修复结果记录与状态流转 (XXWnG2XA) | fix-pipeline | store.ts recordFix |
| 18 | Hono 错误中间件适配器 (EWyykDD_) | sdk-reporter | hono-middleware.ts |
| 19 | LLMClient 模型无关聊天抽象 (7NASKJpk) | llm-core | client.ts |
| 20 | 支持 pi / omp 作为一等公民 Coding Agent (dnu1FN9c) | agent-integration | 新 PiAgentProvider + 默认切换 |
| 21 | CI 自动发布(SDK 双注册表)与自托管部署 (UHSZ3QgU) | delivery | ci.yml publish-sdk/docker/deploy |
| 22 | Claude Code / OpenCode CLI Agent Provider (bvOh48OF) | agent-integration | claude-code-agent.ts 等 |
| 23 | SDK 解析 stack trace 提取 top frame (asSKJ7xR) | sdk-reporter | parseTopFrame |
| 24 | ACP 协议 Coding Agent 接入 (2oiU9usN) | agent-integration | acp-agent.ts |
| 25 | LLM 模式生成并应用 unified diff 补丁 (tJwIegey) | llm-core | generatePatch/applyPatch（apply 在 pipeline 调用） |
| 26 | SDK 注入请求上下文元数据 (_EQZDIT-) | sdk-reporter | metadata 合并 |
| 27 | SDK 捕获运行时异常并上报错误事件 (xMqnhAkl) | sdk-reporter | capture.ts/reporter.ts |
| 28 | AgentProvider 抽象接口与注册表 (Q-n5laNH) | agent-integration | agent-types/registry |
| 29 | Fix History 事件与修复状态展示 (H6Zqcd7B) | web-console | pages/fixes.tsx |

**两处跨模块 story 的主锚裁定**（均有明确边界，非缺口）：
- #15（Agent 模式委托）：编排决策在 pipeline（选 provider、组装 AgentFixRequest、失败降级），归 fix-pipeline；Agent 协议实现本体归 agent-integration（#24/#22/#28）。
- #25（LLM 生成并应用补丁）：生成属 llm-core（generatePatch），应用属 fix-pipeline（applyPatch）；「生成并应用」的增量语义（unified diff 解析为结构化 FixPatch）在 llm-core，故主锚 llm-core。
- 若希望 DevTask 粒度更细，可用 `affected_modules` 标注次级影响面（fix-pipeline / agent-integration），主锚保持唯一。

**存疑点**（供人裁决）：
1. **server 进程的拆分粒度**：`apps/server` 被切成 event-ingest（数据面：/api/events + 托管）与 web-console 的 tRPC 部分（管理面）。若认为「server 进程骨架」应是一个模块（如 host），可合并；当前判断：两类 API 受众（外部 SDK vs 运营者浏览器）职责差异清晰，拆开更利于治理任务定位。
2. **llm-core 当前近乎闲置**：generatePatch 仅在非 Agent 模式使用；UI 的 AgentConfigForm 只暴露 acp 一个选项，opencode/claude-code 实现已写但**未注册**进 AGENT_REGISTRY，pi 尚未实现。模块保留是因为 #19/#25 已接受、#20 将把天平推向 agent-integration。
3. **apps/server/src/pipeline/record.ts 是死代码**：MVP 期 JSONL 审计（fix-records.jsonl），已被 db 的 store.ts 取代但未删。不影响归属；如建清理类 DevTask 可挂 fix-pipeline。
4. **CI deploy 的 alpha tag bug**（story #21 已含 DevTask D85FV53K）：metadata-action 非 main 分支不产出 alpha tag，属 delivery 模块内已知缺陷，映射不受影响。
5. **story #3 措辞**（PROJECT_A_HOST_PATH）与 docker-compose 实际变量（PROJECTS_HOST_PATH）不一致，以代码为准；归属 delivery 不变。

**未读代码**：无——本产品代码全在本地，apps/ packages/ 关键源文件均已通读。
