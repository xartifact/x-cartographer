# X-Cartographer (xcart) — 整体架构设计文档

> 原名：xpm-architecture.md（旧代号 XPM = X Product Manager）。
> 状态：**已实施（2026-08-18）**，本版已按当前实现对齐并清理过时 (tRPC / Next.js) 内容：
> - 命令名由 `xpm` 更名为 `xcart`；CLI 通过 Hono Gateway REST API 交互（原 tRPC 方案已被 Vite+Hono 迁移取代，见 migration-to-vite-hono.md）。
> - `apps/cli` 已实现嵌套子命令 + GNU flag 风格 + 写操作对齐 REST 路由；`skills/` 目录已落地三份 SKILL.md；`xcart skill install` 可一键安装。
>
> 本文档的 CLI 命令树、skills 目录结构、agentskills 多平台安装等为其权威参考。

## 1. 愿景

将现有的 Product Roadmap Web 应用改造为一个 **C/S + B/S 混合架构** 的项目管理平台，让 coding agent（OpenCode、Cursor、Claude Code、Windsurf、Cline 等）能通过 **skills + CLI** 进行需求拆解、任务管理和项目查询。

## 2. 架构总览

```
┌──────────────────────────────────────────────────────────┐
│  Coding Agents                                           │
│  (OpenCode / Cursor / Claude Code / Windsurf / Cline)    │
│                                                          │
│  读取 SKILL.md → 获知可用命令 → 调用 xcart CLI            │
└──────────────┬───────────────────────────────────────────┘
               │ shell exec
               ▼
┌──────────────────────┐
│  apps/cli (xcart)     │  Bun CLI，HTTP client（零依赖）
│  xcart story list     │
│  xcart task next      │
│  xcart project info   │
└──────────┬───────────┘
           │ HTTP REST (Bearer Token)
           ▼
┌──────────────────────────────────────────────┐
│  apps/server (Hono Gateway)                  │
│  Bun.serve, /api/*, apiTokenAuth, /metrics   │
│  路由: projects/journeys/stories/tasks/      │
│        milestones/status-changes/llm/settings│
└──────────┬───────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│  packages/db（drizzle + PGlite/PostgreSQL）  │
│  repositories: project/journey/story/task/   │
│                milestone/status-change       │
└──────────┬───────────────────────────────────┘
           │
           ▼
               packages/shared（Types + Zod Schemas，唯一事实源）
         ┌──────────────────┐
         │   PGlite / PostgreSQL                 │
         └──────────────────┘
```

**关键决策：使用独立 Hono Gateway（`apps/server`，@x-cartographer/gateway）承载全部后端逻辑**，以 REST `/api/*` 暴露；Web 前端与 CLI 通过同一网关读写数据（写操作需 Bearer Token，未配置 token 时本地放行）。MCP Server（`apps/server/src/mcp`）让 AI 代理也能通过 stdio 直连。原"tRPC 嵌入 Next.js"方案已被 Vite+Hono 迁移取代。

## 3. Monorepo 结构

```
x-cartographer/
├── package.json              # Bun workspace root
├── apps/
│   ├── web/                  # Vite + React 19 + TanStack Router（SPA，纯客户端）
│   │   ├── src/
│   │   │   ├── routes/       # TanStack Router 路由
│   │   │   ├── features/     # 前端 feature 模块（requirements/story-map/tasks/...）
│   │   │   ├── lib/api/      # hc REST client + hooks（消费 AppType 类型）
│   │   │   └── components/   # UI 组件
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── server/               # Hono Gateway（@x-cartographer/gateway）
│   │   ├── src/
│   │   │   ├── app.ts        # Hono 装配（basePath /api + auth + metrics）
│   │   │   ├── routes/       # projects/journeys/stories/tasks/milestones/...
│   │   │   ├── mcp/          # MCP Server（stdio，供 AI 代理直连）
│   │   │   └── index.ts      # Bun.serve 入口
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── cli/                  # xcart CLI（零依赖，手写 GNU flag 解析）
│       └── src/index.ts      # 全量命令实现（嵌套子命令 + 写操作）
├── packages/
│   ├── db/                   # drizzle + PGlite/PostgreSQL + repositories
│   ├── shared/               # 共享类型 & Zod schemas（唯一类型事实源）
│   └── ui/                   # Radix/Tailwind 组件库
├── skills/                   # Agent skill 文件（agentskills 标准）
│   ├── xcart-project-overview/SKILL.md
│   ├── xcart-story-breakdown/SKILL.md
│   └── xcart-task-management/SKILL.md
├── tests/                    # 根级专项测试（vitest / bun:test）
└── docs/design/              # 设计文档
```

### 包依赖关系

```
apps/web    → packages/shared, packages/ui   → HTTP REST → apps/server
apps/cli    → HTTP REST → apps/server（自包含，无内部包依赖）
apps/server → packages/db, packages/shared
packages/db → packages/shared
```

## 4. API 设计（REST，Hono Gateway）

CLI 通过 Gateway REST API 交互（`apps/server/src/routes/`，basePath `/api`，写操作需 Bearer Token；字段校验 schema 以 `packages/shared` zod 为准）。

| 资源 | 路由文件 | 端点（摘要） |
|------|---------|-------------|
| project | projects.ts | `GET /` `GET /search` `GET /:id` `POST /` `PATCH /:id` `DELETE /:id` `PUT /full` |
| journey | journeys.ts | `GET /?projectId=` `POST /` `PATCH /:id` `DELETE /:id` |
| story | stories.ts | `GET /?journeyId=` `GET /:id` `POST /` `PATCH /:id` `POST /:id/status` `DELETE /:id` |
| task | tasks.ts | `GET /?storyId=` `GET /next?projectId=` `GET /:id` `POST /` `PATCH /:id` `POST /:id/status` `DELETE /:id` |
| milestone | milestones.ts | `GET /?projectId=` `POST /` `PATCH /:id` `DELETE /:id` |
| status-changes | status-changes.ts | `GET /[?entityId=]` `POST /` |
| llm | llm.ts | `POST /analyze-requirements` `POST /generate-journey-suggestions` `POST /decompose-story` `POST /scheduling-suggestions` |
| settings | settings.ts | `PUT/DELETE /llm/:provider` `GET /llm/status` `POST /llm/:provider/test` `GET/POST/DELETE /token` |

## 5. CLI 命令设计 (xcart)

> 已实现命令面以 `xcart --help` 为准；下表为设计参考。尚未实现：`project use/import`、`task done/block`、`.xcartrc` 全局配置、`--project/-p` 全局活跃项目（当前须显式传 `--project <id>`）。

### 5.1 全局选项

```
xcart [command] [subcommand] [options]

Global Options:
  --server, -s <url>   Server URL（默认 $XCART_API_URL / http://localhost:8787）
  --token,  -t <token> API Token（默认 $XCART_API_TOKEN）
  --format, -f <fmt>   Output format: table | json | markdown（默认 table）
  --help, -h           显示帮助
  --version, -v        显示版本
```

### 5.2 项目管理

```bash
xcart project list                           # 列出所有项目
xcart project info --id <id>                 # 项目详情（含 journeys + milestones）
xcart project create --name "My App" [--description] [--tech-stack ts,react]
xcart project update <id> [--name] [--description]
xcart project delete <id>
```

### 5.3 用户旅程

```bash
xcart journey list --project <id>            # 当前项目的所有旅程
xcart journey info <id>                      # 该旅程下的故事
xcart journey create --project <id> --name "User Onboarding" --persona "New User"
xcart journey update <id> --name "..."
xcart journey delete <id>
```

### 5.4 用户故事

```bash
xcart story list --journey <id>
xcart story info <id>
xcart story create --journey <id> --title "As a user, I want ..." --priority high
xcart story update <id> [--title] [--priority] [--status] [--milestone <mid>|none]
xcart story status <id> <status> [--reason]
xcart story bulk-create --journey <id> --file stories.json
```

### 5.5 任务管理

```bash
xcart task list --story <id>
xcart task info <id>
xcart task create --story <id> --title "Implement PDF export" --type technical_task
xcart task update <id> [--status] [--assignee] [--priority] [--type] [--estimation]
xcart task status <id> <status> [--reason]
xcart task next --project <id> [--assignee]   # 下一个可执行任务（todo 且依赖已完成）
xcart task summary --project <id>             # 任务统计
xcart task bulk-create --story <id> --file tasks.json
```

### 5.6 查询与报告

```bash
xcart status history <entityId>              # 状态变更历史
xcart overview --project <id>                # 项目总览（进度、统计）
xcart context export <projectId>             # 项目全景 Markdown（供 LLM）
```

### 5.7 输出格式

```bash
$ xcart task next --format json
{
  "id": "TASK-042",
  "title": "Implement PDF export endpoint",
  "story_id": "US-012",
  "type": "technical_task",
  "priority": "P1",
  "status": "todo",
  "dependencies": [],
  "estimation": 4
}
```

## 6. Skills 适配设计

### 6.1 统一标准

基于 agentskills.io 开放标准，SKILL.md + YAML frontmatter 格式。OpenCode、Claude Code、Windsurf 共同支持。Cursor 和 Cline 提供等效 rules 文件。

### 6.2 多平台安装

| 平台 | 安装位置 |
|------|---------|
| OpenCode | `.opencode/skills/` 或 `~/.config/opencode/skills/` |
| Claude Code | `.claude/skills/` 或 `~/.claude/skills/` |
| Windsurf | `.windsurf/skills/` 或 `~/.codeium/windsurf/skills/` |
| Cursor | `.cursor/rules/xcart-*.md` |
| Cline | `.clinerules/xcart-*.md` |

提供 `xcart skill install` 一键安装（支持 `--dir` 指定目录）。

## 7. 实施记录

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase A: 命名 | `@xpm/* → @x-cartographer/*`、命令 `xpm → xcart`、环境变量 `XCART_API_URL/XCART_API_TOKEN` | ✅ |
| Phase B: CLI | 嵌套子命令 + GNU flag 风格 + 写操作对齐 REST + `--format json` + 旧扁平命令别名兼容 | ✅ |
| Phase C: Skills | `skills/` 三份 SKILL.md（project-overview / story-breakdown / task-management）+ `xcart skill install` | ✅ |
| 验证 | `bun test` 148 pass；web 63 pass；web/server/cli type-check 通过；oxlint 0 errors | ✅ |

> 早期 tRPC / Next.js 迁移方案的历史细节见 docs/design/migration-to-vite-hono.md。

## 8. 技术选型汇总

| 维度 | 选择 | 理由 |
|------|------|------|
| Monorepo | Bun Workspaces | 现有项目用 Bun |
| Web | Vite + React 19 + TanStack Router | SPA，纯客户端（原 Next.js 已迁移） |
| API | Hono REST（apps/server，Bun.serve） | 轻量；hc client 消费 `AppType` 类型安全 |
| CLI | 自研零依赖 flag 解析 | subcommand + GNU flag 足够，避免额外依赖 |
| DB | PGlite / PostgreSQL + Drizzle | 保持现有 |
| 类型 | packages/shared（zod4） | 唯一类型事实源 |
| Skill | agentskills.io | 多平台支持 |
