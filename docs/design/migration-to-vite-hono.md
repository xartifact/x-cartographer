# X-Cartographer 迁移技术方案：Next.js+tRPC → Vite+TanStack Router+Hono

> 状态: 已定稿（2026-08-13）
> 范围: 全量对齐参考依赖表；仅技术栈与架构维度；业务功能按 `.user-stories` MVP 任务验收（143 项）

## 1. 目标架构

```
x-cartographer/
├── apps/
│   ├── web/                  # Vite + React 19 + TanStack Router（SPA，纯客户端）
│   └── cli/                  # 保留（commander + @clack/prompts）
├── packages/
│   ├── db/                   # drizzle-orm + postgres + pglite + drizzle-kit（原 packages/core）
│   ├── gateway/              # Hono API 服务（Bun.serve），承载全部后端逻辑
│   ├── shared/               # zod4 schema + 类型（唯一类型事实源）
│   └── ui/                   # tailwind4 + radix + cva + tailwind-merge 组件库
├── docs/
│   └── (含 astro starlight 文档站点，独立 workspace)
└── tests/                    # vitest 组件测试 / bun:test 后端测试
```

## 2. 依赖映射（现状 → 目标）

| 目标包 | 现状 | 动作 |
|---|---|---|
| react ^19 / react-dom ^19 | ^18.3.0 | 升级 |
| @tanstack/react-router ^1.170.6 | 无 | 新增（替代 next/link、next/navigation） |
| @tanstack/react-query ^5.90.20 | ^5.59.0 | 升级（保留，去 tRPC 适配层） |
| vite ^6 | 无 | 新增（替代 next dev/build） |
| hono ^4 | 无 | 新增（替代 tRPC + Server Actions） |
| zod ^4.4.3 | ^3.23.8 | 升级（shared 全量） |
| drizzle-orm ^0.45.1 | ^0.45.1 | 保留 |
| drizzle-kit ^0.31.8 | bunx drizzle-kit | 移入 packages/db |
| postgres ^3.4.3 | pg ^8.20.0 | 换驱动 |
| @electric-sql/pglite ^0.4.3 | ^0.4.0 | 升级 |
| pino / pino-pretty | pino ^10.3.1 | 保留 + 补 pino-pretty |
| prom-client ^15.1.3 | 无 | 新增（gateway /metrics） |
| json5 / jsonrepair | 无 | 新增（LLM 输出宽松解析） |
| ajv ^8.20.0 | 无 | 新增（@rjsf validator） |
| @dagrejs/dagre ^3 | 无 | 新增（图布局，替代自研布局） |
| @xyflow/react ^12.10.1 | 无 | 新增（故事地图画布，替代 @dnd-kit 自绘） |
| recharts ^2.15.0 | 无 | 新增（统计图表） |
| monaco-editor / @monaco-editor/react | 无 | 新增（代码/JSON 编辑） |
| @rjsf/core+utils+validator-ajv8 ^6.6.2 | 无 | 新增（JSON Schema 动态表单） |
| react-hook-form ^7.55 + @hookform/resolvers | 无 | 新增（表单） |
| tailwindcss ^4.3 + @tailwindcss/postcss | ^3.4.15 | 升级（CSS-first 配置） |
| tailwind-merge / cva | 无 | 新增（cn + 变体） |
| @radix-ui/react-* | 部分（17 个原语） | 补全（label/scroll-area/select/switch） |
| lucide-react ^0.563 | 无 | 新增（图标，替代自绘 SVG） |
| sonner ^2 | 无 | 新增（Toast，替代自绘 toaster） |
| next-themes ^0.4.6 | ^0.4.4 | 保留（peer next 缺失，若运行失败改等价实现） |
| date-fns ^4.1 / clsx ^2.1.1 | 无/有 | 新增/保留 |
| commander ^12 / @clack/prompts ^1.5.1 | 无 | 新增（cli 包） |
| js-yaml ^4.1 | 无 | 新增 |
| @astrojs/starlight + astro ^5 | 无 | 新增（docs 站点，独立 workspace） |
| typescript ^5.3.3+ | ^5.6.3 | 保留 |
| oxlint / oxfmt | prettier | 替换根工具链 |
| bun:test / vitest ^4 / @testing-library / jsdom / happy-dom / @playwright/test / @vitejs/plugin-react / lint-staged | bun:test + node 测试 | 按表补全 |

## 3. REST API 设计（packages/gateway）

tRPC 27 procedures + 7 server actions 统一映射为 Hono REST。**`status.actions.ts` 无消费者，直接删除。**

### 资源路由

| 方法+路径 | 来源（tRPC procedure / action） | 说明 |
|---|---|---|
| GET /api/projects | project.list | repo.findAll |
| GET /api/projects/search?q= | project.search | LIKE |
| GET /api/projects/:id | project.byId | |
| POST /api/projects | project.create | |
| PATCH /api/projects/:id | project.update | |
| DELETE /api/projects/:id | project.delete | |
| PUT /api/projects/full | project.saveFull | 事务写全树 |
| GET /api/journeys?projectId= | journey.listByProject | |
| POST /api/journeys | journey.create | |
| PATCH /api/journeys/:id | journey.update | |
| DELETE /api/journeys/:id | journey.delete | |
| GET /api/stories?journeyId= | story.listByJourney | |
| GET /api/stories/:id | story.byId | |
| POST /api/stories | story.create | |
| PATCH /api/stories/:id | story.update | |
| DELETE /api/stories/:id | story.delete | |
| POST /api/stories/:id/status | story.updateStatus | + StatusChange 写入 |
| GET /api/tasks?storyId= | task.listByStory | |
| GET /api/tasks/:id | task.byId | |
| GET /api/tasks/next?projectId= | task.next | 内存拓扑规则 |
| POST /api/tasks | task.create | |
| PATCH /api/tasks/:id | task.update | |
| DELETE /api/tasks/:id | task.delete | |
| POST /api/tasks/:id/status | task.updateStatus | |
| GET /api/status-changes?entityId= | status.getHistory | |
| GET /api/status-changes | status.getAll | |
| POST /api/status-changes | status.create | |

### LLM / 设置路由（原 Server Actions）

| 方法+路径 | 来源 action | 说明 |
|---|---|---|
| POST /api/llm/analyze-requirements | analyzeRequirements | |
| POST /api/llm/generate-journey-suggestions | generateJourneySuggestions | |
| POST /api/llm/decompose-story | decomposeStory | |
| PUT /api/settings/llm/:provider | saveLLMKey | |
| DELETE /api/settings/llm/:provider | deleteLLMKey | |
| GET /api/settings/llm/status | getLLMKeyStatus | |
| POST /api/settings/llm/:provider/test | testLLMConnection | |

### LLM 调用层重写
依赖表无 @ai-sdk/*。`lib/llm/ai-provider.ts` 改为原生 fetch（OpenAI/Anthropic 兼容端点）+ `json5`/`jsonrepair` 宽松解析 LLM 输出。prompts/schema 保留。

## 4. 前端路由映射（Next 9 路由 → TanStack Router）

| Next 路径 | TanStack Router | 渲染 |
|---|---|---|
| / | / (index) | 首页三卡片 |
| /projects | /projects | ProjectList + dialogs |
| /projects/[id] | /projects/$projectId | 概览 |
| /projects/[id]/layout | _layout（nested route） | ProjectNav + Outlet |
| /projects/[id]/requirements | /projects/$projectId/requirements | RequirementsPage |
| /projects/[id]/story-map | /projects/$projectId/story-map | StoryMapCanvas |
| /projects/[id]/tasks | /projects/$projectId/tasks | TasksPage |
| /projects/[id]/data | /projects/$projectId/data | DataBrowserPage |
| /settings | /settings | LLMSettings |

Provider 嵌套（根 route layout）：QueryClientProvider → ThemeProvider → AppLayout → Toaster。
`next/font` → `@fontsource-variable/inter`；`Metadata` → index.html；`next/image` 无（全部 raw img）。

## 5. 数据流规范（强制）

1. **客户端唯一数据通道**：`@/lib/api` 的 typed fetch（hono client）+ react-query hooks。禁止客户端 import `packages/db` repository、禁止 'use server' 文件。
2. **服务端状态归 react-query**：项目/journey/story/task/status 数据全部走 query/mutation + onSuccess 失效。
3. **zustand 仅存 UI 状态**：activeProjectId、searchQuery、选中集、筛选、画布 zoom/position、requirement 草稿。
4. **修复现状 WIP 断裂**：components 按旧 store 契约调用（getFilteredProjects/modifyProject/initialize/getEntityHistory…）——迁移时统一收敛到 react-query hooks，删除过期契约。

## 6. UI 组件库

- packages/ui：radix 原语 + cva 变体 + tailwind-merge `cn()`，17 个现有 shadcn 组件按 tailwind4 CSS 变量迁移 + 补 label/scroll-area/select/switch。
- 全局样式：tailwind4 `@import "tailwindcss"` + `@theme` 变量（shadcn HSL token + priority/task 自定义变量迁移）。
- 新增能力按依赖表：xyflow（故事地图画布）、dagre（布局）、recharts（统计）、monaco（JSON/TOML 编辑）、rjsf（动态表单）、sonner（toast）。

## 7. 工具链

- 根：oxlint（lint）、oxfmt（format）替代 prettier；lint-staged 保留。
- 测试：packages/db+gateway → bun:test；apps/web 组件 → vitest + testing-library + jsdom/happy-dom；E2E → playwright。

## 8. 迁移阶段（顺序依赖）

| 阶段 | 内容 | 依赖 |
|---|---|---|
| A. 地基 | packages/db（core→db 演化）、shared zod4、packages/gateway（Hono+REST） | 无 |
| B. web 壳 | Vite + TanStack Router + index.html + providers，路由树先渲染占位 | A |
| C. UI 库 | packages/ui + tailwind4 + 全局样式 | B |
| D. 数据层切换 | lib/api typed client + react-query hooks 重写 trpc/hooks | A, B |
| E. feature 重构 | 10 个 feature 逐一切到新 hooks，删 tRPC/'use server'/旧契约 | C, D |
| F. 新依赖对齐 | xyflow/dagre/recharts/monaco/rjsf/react-hook-form/sonner 落地 | E |
| G. 工具链 | oxlint/oxfmt/vitest/playwright 配置 + 测试 | E |
| H. 验收 | type-check 全绿 + MVP 143 任务核对 + 浏览器冒烟 | 全部 |

## 9. 风险

1. **WIP 断裂代码**：迁移必须"重写而非修补"，避免在坏契约上叠加。
2. **zod3→4**：schema 语法有破坏性变更，shared 需全量重写校验。
3. **LLM 层去 SDK**：ai-sdk 的 generateObject 结构化输出 → 原生 fetch + json5 解析，输出稳定性下降，需降级路径。
4. **xyflow 重写画布**：现有拖拽/缩放/动画逻辑重写为 xyflow 节点体系，视觉行为需回归。
5. **PGlite 双端**：浏览器端 PGlite 移除，web 全走 HTTP；`data/pglite` 由 gateway 独占。
6. **next-themes peer**：Vite 下缺 next peer，若运行失败改用自研 ThemeProvider。
