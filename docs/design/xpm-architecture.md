# XPM (X Product Manager) — 整体架构设计文档

> Coding Agent 外挂的任务管理插件/服务

## 1. 愿景

将现有的 Product Roadmap Web 应用改造为一个 **C/S + B/S 混合架构** 的项目管理平台，让 coding agent（OpenCode、Cursor、Claude Code、Windsurf、Cline 等）能通过 **skills + CLI** 进行需求拆解、任务管理和项目查询。

## 2. 架构总览

```
┌──────────────────────────────────────────────────────────┐
│  Coding Agents                                           │
│  (OpenCode / Cursor / Claude Code / Windsurf / Cline)    │
│                                                          │
│  读取 SKILL.md → 获知可用命令 → 调用 xpm CLI             │
└──────────────┬───────────────────────────────────────────┘
               │ shell exec
               ▼
┌──────────────────────┐
│  apps/cli (xpm)      │  Bun CLI，HTTP client
│  xpm story list      │
│  xpm task next       │
│  xpm project info    │
└──────────┬───────────┘
           │ HTTP (tRPC)
           ▼
┌──────────────────────────────────────────────┐
│  apps/web (Next.js)                          │
│  ┌─────────────────┐  ┌──────────────────┐   │
│  │  Web UI (SPA)   │  │  tRPC API Routes │   │
│  │  tRPC React     │  │  /api/trpc/*     │   │
│  │  Query client   │  │  (嵌入式 Server) │   │
│  └─────────────────┘  └────────┬─────────┘   │
└────────────────────────────────┼──────────────┘
                                 │
                                 ▼
               ┌──────────────────────────┐
               │  packages/core           │
               │  Service + Repository    │
               └──────────┬───────────────┘
                          │
                          ▼
               ┌──────────────────────────┐
               │  packages/shared         │
               │  Types + Zod Schemas     │
               └──────────┬───────────────┘
                          │
                          ▼
                   PGlite / PostgreSQL
```

**关键决策：tRPC Server 嵌入 Next.js**，作为 `/api/trpc/*` API route 运行。CLI 通过 HTTP 调用同一地址。

## 3. Monorepo 结构

```
x-product-roadmap/
├── package.json              # Bun workspace root
├── bunfig.toml
├── apps/
│   ├── web/                  # Next.js 前端 + tRPC Server (现有代码迁移)
│   │   ├── src/
│   │   │   ├── app/          # Next.js App Router
│   │   │   │   └── api/trpc/ # tRPC HTTP handler
│   │   │   ├── components/   # UI 组件
│   │   │   ├── features/     # 前端 feature 模块
│   │   │   ├── hooks/
│   │   │   └── trpc/         # tRPC React client setup
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── cli/                  # xpm CLI
│       ├── src/
│       │   ├── commands/     # 命令实现
│       │   ├── client.ts     # tRPC HTTP client
│       │   └── index.ts      # bin entry
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── core/                 # 业务核心（Service + Repository）
│   │   ├── src/
│   │   │   ├── services/     # 业务逻辑
│   │   │   ├── repositories/ # 数据访问（现有迁移）
│   │   │   ├── db/           # 数据库 client & schema（现有迁移）
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared/               # 共享类型 & 校验
│       ├── src/
│       │   ├── schemas/      # Zod schemas（输入/输出）
│       │   ├── types/        # TypeScript types
│       │   └── constants/    # 枚举、状态机定义
│       ├── package.json
│       └── tsconfig.json
├── skills/                   # Agent skill 文件
│   ├── xpm-task-management/
│   │   └── SKILL.md
│   ├── xpm-story-breakdown/
│   │   └── SKILL.md
│   └── xpm-project-overview/
│       └── SKILL.md
└── docs/
    └── design/
        └── xpm-architecture.md  # 本文档
```

### 包依赖关系

```
apps/web    → packages/core, packages/shared
apps/cli    → packages/shared  → tRPC HTTP client → apps/web (API)
packages/core → packages/shared
```

## 4. API 设计 (tRPC)

### 4.1 Router 结构

```typescript
export const appRouter = router({
  project: projectRouter,
  journey: journeyRouter,
  story: storyRouter,
  task: taskRouter,
  status: statusRouter,
});
```

### 4.2 Project Router

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `project.list` | query | void | Project[] |
| `project.getById` | query | `{ id }` | Project |
| `project.create` | mutation | `{ name, description?, metadata?, settings? }` | Project |
| `project.update` | mutation | `{ id, ...partial }` | Project |
| `project.delete` | mutation | `{ id }` | void |
| `project.search` | query | `{ query }` | Project[] |
| `project.count` | query | void | number |
| `project.importToml` | mutation | `{ toml }` | Project |

### 4.3 Journey Router

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `journey.listByProject` | query | `{ projectId }` | UserJourney[] |
| `journey.create` | mutation | `{ projectId, name, persona?, description? }` | UserJourney |
| `journey.update` | mutation | `{ id, ...partial }` | UserJourney |
| `journey.delete` | mutation | `{ id }` | void |
| `journey.reorder` | mutation | `{ projectId, orderedIds }` | void |

### 4.4 Story Router

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `story.getById` | query | `{ id }` | UserStory |
| `story.listByJourney` | query | `{ journeyId }` | UserStory[] |
| `story.listByProject` | query | `{ projectId }` | UserStory[] |
| `story.create` | mutation | `{ journeyId, title, ...opts }` | UserStory |
| `story.update` | mutation | `{ id, ...partial }` | UserStory |
| `story.delete` | mutation | `{ id }` | void |
| `story.updateStatus` | mutation | `{ id, status, reason? }` | UserStory |
| `story.reorder` | mutation | `{ journeyId, orderedIds }` | void |
| `story.bulkCreate` | mutation | `{ journeyId, stories[] }` | UserStory[] |

### 4.5 Task Router

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `task.getById` | query | `{ id }` | Task |
| `task.listByStory` | query | `{ storyId }` | Task[] |
| `task.listByProject` | query | `{ projectId, filters? }` | Task[] |
| `task.create` | mutation | `{ storyId, title, type?, ...opts }` | Task |
| `task.update` | mutation | `{ id, ...partial }` | Task |
| `task.delete` | mutation | `{ id }` | void |
| `task.updateStatus` | mutation | `{ id, status, reason? }` | Task |
| `task.next` | query | `{ projectId, assignee? }` | Task \| null |
| `task.bulkCreate` | mutation | `{ storyId, tasks[] }` | Task[] |
| `task.summary` | query | `{ projectId }` | TaskSummary |

### 4.6 Status Router

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `status.getHistory` | query | `{ entityId }` | StatusChange[] |

## 5. CLI 命令设计 (xpm)

### 5.1 全局选项

```
xpm [command] [subcommand] [options]

Global Options:
  --server, -s    Server URL (default: http://localhost:3000)
  --project, -p   Active project ID (or from .xpmrc)
  --format, -f    Output format: table | json | markdown (default: table)
  --help, -h      Show help
  --version, -v   Show version
```

### 5.2 项目管理

```bash
xpm project list                           # 列出所有项目
xpm project info [--id <id>]               # 项目详情（默认当前项目）
xpm project create --name "My App"         # 创建项目
xpm project use <id>                       # 设置当前活跃项目（写入 .xpmrc）
xpm project import --file roadmap.toml     # 从 TOML 导入
```

### 5.3 用户旅程

```bash
xpm journey list                           # 当前项目的所有旅程
xpm journey create --name "User Onboarding" --persona "New User"
xpm journey update <id> --name "..."
```

### 5.4 用户故事

```bash
xpm story list [--journey <id>] [--status <status>]
xpm story info <id>
xpm story create --journey <id> --title "As a user, I want ..."
xpm story update <id> --status in_progress --priority high
xpm story bulk-create --journey <id> --file stories.json
```

### 5.5 任务管理

```bash
xpm task list [--story <id>] [--status <status>] [--assignee <name>]
xpm task info <id>
xpm task create --story <id> --title "Implement PDF export" --type technical_task
xpm task update <id> --status in_progress --assignee "agent-1"
xpm task done <id> [--reason "Completed implementation"]
xpm task block <id> --reason "Waiting for API design"

# Agent 核心命令
xpm task next [--assignee <name>]           # 获取下一个可执行任务
xpm task bulk-create --story <id> --file tasks.json
xpm task summary                            # 项目任务统计概览
```

### 5.6 查询与报告

```bash
xpm status history <entity-id>              # 状态变更历史
xpm overview                                # 项目总览（进度、阻塞项、统计）
```

### 5.7 输出格式

```bash
$ xpm task next --format json
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

### 5.8 配置文件 (.xpmrc)

```toml
server = "http://localhost:3000"
project_id = "proj-abc123"
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
| Cursor | `.cursor/rules/xpm-*.md` |
| Cline | `.clinerules/xpm-*.md` |

提供 `xpm skill install` 一键安装。

## 7. 迁移计划

### Phase 0: Monorepo 基础设施
初始化 Bun workspace，创建 apps/ 和 packages/ 目录结构，配置包间引用。

### Phase 1: packages/shared
迁移 types、constants，创建 Zod schemas。

### Phase 2: packages/core
迁移 db/schema/repositories，创建 Service 层。

### Phase 3: apps/web (tRPC + 迁移)
安装 tRPC，创建 routers，迁移 Next.js 代码，替换 Server Actions。

### Phase 4: apps/cli (xpm)
CLI 框架 + tRPC client + 命令实现 + 输出格式化。

### Phase 5: Skills
编写 SKILL.md，实现 `xpm skill install`。

## 8. 技术选型汇总

| 维度 | 选择 | 理由 |
|------|------|------|
| Monorepo | Bun Workspaces | 现有项目用 Bun |
| API | tRPC v11 | 类型安全，适合 monorepo |
| Server | 嵌入 Next.js | 单进程，`/api/trpc/*` |
| CLI | commander / citty | 成熟，subcommand 好 |
| DB | PGlite / PostgreSQL | 保持现有 |
| ORM | Drizzle | 保持现有 |
| Skill | agentskills.io | 多平台支持 |
