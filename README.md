# X-Cartographer

**AI-Native 的研发需求与任务管理工具**：基于 LLM 将自然语言需求分析为结构化用户故事，以**故事地图**（Story Map）可视化规划，拆解为可执行任务，并贯穿研发全流程进行任务管理与版本（milestone）排期。

同时，X-Cartographer 面向 AI 代理开放：通过 **`xcart` CLI + 内置 Skills（SKILL.md）** 让 Claude Code、OpenCode、Cursor、Windsurf、Cline 等 coding agent 直接读取、拆解和推进需求与任务。

## 核心能力

- **AI 需求分析**：自然语言输入 → LLM（OpenAI / Anthropic / X-Herald）分析出用户角色、功能点、使用场景
- **故事地图规划**：用户旅程 → 用户故事可视化画布（@xyflow/react），支持拖拽/筛选/版本关联
- **任务拆解与排期**：LLM 将故事拆解为任务，按里程碑（版本）智能排期
- **研发任务管理**：任务状态流（backlog→todo→in_progress→in_review→testing→done）、依赖拓扑、`next` 可执行任务推荐、状态历史
- **面向 AI 集成**：REST API + API Token 认证、`xcart` CLI、MCP Server、**Agent Skills**、项目全景上下文导出

## 技术栈与架构

| 层 | 选型 |
|---|---|
| 前端 | **Vite + React 19 + TanStack Router**（SPA，纯客户端）+ TanStack Query + Zustand |
| 后端 | **Hono Gateway**（Bun.serve），REST `/api/*`，Bearer Token 认证，prometheus `/metrics` |
| 存储 | PGlite（内嵌 PostgreSQL）/ PostgreSQL + **Drizzle ORM** |
| 类型事实源 | `packages/shared`（zod4 schema + 类型） |
| CLI | **`xcart`**（Bun，零依赖，嵌套子命令 + GNU flag） |
| 测试 | bun:test（后端）+ vitest（前端单测）+ Playwright（e2e） |
| 工具链 | oxlint / oxfmt |

> 早期基于 Next.js + tRPC 的方案已迁移到 Vite + Hono，见 `docs/design/migration-to-vite-hono.md`；整体架构见 `docs/design/x-cartographer-architecture.md`。

## Monorepo 结构

```
x-cartographer/
├── apps/
│   ├── web/                  # Vite + React 19 + TanStack Router（SPA）
│   ├── server/               # Hono Gateway（@x-cartographer/gateway），含 MCP Server
│   └── cli/                  # xcart CLI（@x-cartographer/cli）
├── packages/
│   ├── db/                   # Drizzle + PGlite/PostgreSQL + repositories
│   ├── shared/               # zod4 schema + 类型（唯一类型事实源）
│   └── ui/                   # Radix + Tailwind 组件库
├── skills/                   # Agent Skills（被 AI 集成：SKILL.md）
├── tests/                    # 根级专项测试
└── docs/design/              # 设计文档
```

## 快速开始

```bash
bun install

# 启动前端（Vite dev server）
bun run dev

# 启动后端 Gateway（默认 http://localhost:8787）
bun run dev:api

# 构建 / 类型检查 / lint / 测试
bun run build
bun run type-check
bun run lint
bun run test
```

## xcart CLI（面向脚本与 AI 代理）

`xcart` 是 X-Cartographer 的命令行接口，直接操作 Gateway REST API。

```bash
# 开发环境调用（仓库内）
bun run --cwd apps/cli src/index.ts <command> ...

# 全局安装为 xcart 命令（仓库内）
cd apps/cli && bun link

# 直接可执行（脚本解析推荐加 --format json）
xcart project list
xcart project info --id <projectId>
xcart journey list --project <projectId>
xcart story list --journey <journeyId>
xcart story create --journey <journeyId> --title "..." --priority high
xcart task list --story <storyId>
xcart task next --project <projectId>          # 下一个可执行任务
xcart task status <taskId> in_progress --reason "开始"
xcart milestone list --project <projectId>
xcart overview --project <projectId>           # 项目总览
xcart context export <projectId>               # 全景 Markdown（供 LLM）
xcart skill install                            # 安装 Skills 到各 agent 目录
xcart --help
```

**全局选项 / 环境变量**

| 项 | 说明 |
|---|---|
| `--server / -s <url>` 或 `XCART_API_URL` | Gateway 地址（默认 `http://localhost:8787`） |
| `--token / -t <token>` 或 `XCART_API_TOKEN` | API Token（Gateway 启用认证时需要） |
| `--format / -f table\|json\|markdown` | 输出格式（脚本解析用 `json`） |

完整命令树与语义见 `apps/cli/src/index.ts` 顶部用法说明，以及各 SKILL.md。

> 旧命令名 `xpm` 已更名为 `xcart`（旧代号 XPM = X Product Manager）。

## Agent Skills（被 AI 集成）

`skills/` 目录提供符合 [agentskills.io](https://agentskills.io) 标准的 SKILL.md，让 coding agent 学会使用 `xcart` CLI 操作产品：

| Skill | 作用 |
|---|---|
| `skills/xcart-project-overview/SKILL.md` | 查询项目/版本/全景上下文，供 LLM 评审规划 |
| `skills/xcart-story-breakdown/SKILL.md` | 旅程/故事维护、需求拆分为故事、版本排期 |
| `skills/xcart-task-management/SKILL.md` | 任务生命周期、`task next` 可执行任务、统计与历史 |

一键安装到各 agent 平台：

```bash
xcart skill install            # 默认安装到仓库内 .claude/.opencode/.windsurf/.cursor/.clinerules
xcart skill install --dir <path>   # 或自定义目标目录
```

| 平台 | 安装位置 |
|---|---|
| Claude Code | `.claude/skills/` 或 `~/.claude/skills/` |
| OpenCode | `.opencode/skills/` 或 `~/.config/opencode/skills/` |
| Windsurf | `.windsurf/skills/` 或 `~/.codeium/windsurf/skills/` |
| Cursor | `.cursor/rules/xcart-*.md` |
| Cline | `.clinerules/xcart-*.md` |

## 其他 AI 集成入口

- **REST API**：`apps/server`（basePath `/api`），Go `GET /api/projects` 或 `POST /api/stories` 等；写操作需 `Authorization: Bearer <token>`（未配置 token 时本地放行）。
- **MCP Server**：`apps/server/src/mcp/server.ts`，stdio 传输，供 Claude Code 等直连：
  ```bash
  bun run --cwd apps/server src/mcp/server.ts
  # 环境变量：XCART_API_URL / XCART_API_TOKEN
  ```
- **AI 调度**：`POST /api/llm/scheduling-suggestions` 基于里程碑智能排期。

## 许可证

（按需补充）
