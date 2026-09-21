# X-Cartographer

**AI-Native 的研发需求与任务管理工具**：基于 LLM 将自然语言需求分析为结构化用户故事，以**故事地图**（Story Map）可视化规划，拆解为可执行任务，并贯穿研发全流程进行任务管理与版本（milestone）排期。

同时，X-Cartographer 面向 AI 代理开放：通过 **`xcart` CLI + 内置 Skills（SKILL.md）** 让 Claude Code、OpenCode、Cursor、Windsurf、Cline 等 coding agent 直接读取、拆解和推进需求与任务。

## 核心能力

- **故事地图规划**：用户故事地图（Patton 语义：Product / 用户活动 → 用户任务 → 用户故事 + 研发任务），可视化画布（@xyflow/react），支持拖拽/筛选/版本切片
- **任务拆解与排期**：故事拆解为研发任务，按里程碑（版本）排期，Roadmap 泳道视图
- **研发任务管理**：状态流（backlog→todo→in_progress→in_review→testing→done）、乐观锁防并发冲突、依赖拓扑、`next` 可执行任务推荐、状态历史
- **技术宪法（ADR 账本）**：把"怎么做"沉淀为可审计约束——架构原则（RFC 2119 强制力 MUST/SHOULD/MAY/MUST_NOT）、技术栈选型、系统模块目录。**仅追加账本**（除状态外不可变），当前态由 accepted 记录折叠而来，可按里程碑回溯历史架构；模块目录是独立一等实体（ADR 只引用、不定义）。关键设计：原则是**纯信息注入**，不拦截任何状态流转——它约束实现方式，不做审批门禁
- **面向 AI 集成**：REST API + API Token 认证、`xcart` CLI、**Agent Skills**、产品全景上下文导出（含技术宪法全文）；`xcart ctx <taskId>` 给出动工前的上下文切片（意图/结构/规矩/依赖），`xcart story info` / `task info` 按模块范围过滤出相关架构原则

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

> 早期基于 Next.js + tRPC 的方案已迁移到 Vite + Hono，见 `docs/design/migration-to-vite-hono.md`；整体架构见 `docs/design/x-cartographer-architecture.md`；技术宪法（ADR）模型与消费契约见 `docs/design/technical-constitution.md`，域划分（约束/工作/证据三空间）见 `docs/design/domain-model.md`。

## Monorepo 结构

```
x-cartographer/
├── apps/
│   ├── web/                  # Vite + React 19 + TanStack Router（SPA）
│   ├── server/               # Hono Gateway（@x-cartographer/gateway）
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
xcart activity list --project <productId>      # 用户活动（故事地图骨干；journey 为过时别名）
xcart story list --activity <activityId>
xcart story create --activity <activityId> --title "..." --priority high
xcart task list --story <storyId>
xcart task next --project <projectId>          # 下一个可执行任务
xcart task status <taskId> in_progress --reason "开始"
xcart task status <taskId> done --expected-status in_progress   # CAS 乐观锁：防并发认领冲突（不符返回 409）
xcart milestone list --project <projectId>
xcart module list --project <projectId>        # 系统模块目录（技术宪法的结构词汇）
xcart adr current --project <projectId>        # 当前生效技术宪法（架构原则/技术栈/模块）
xcart adr create --project <projectId> --title <t> --context <c> --decision <d> --file changes.json
xcart overview --project <projectId>           # 项目总览（含技术宪法计数）
xcart context export <projectId>               # 全景 Markdown（含技术宪法节，供 LLM）
xcart ctx <taskId>                             # 任务上下文切片（意图/结构/规矩/依赖）
xcart trace <story|module|adr> <id>            # 约束追溯链
xcart skill install                            # 安装 Skills 到 .claude/skills
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
| `skills/xcart-story-breakdown/SKILL.md` | 活动/故事维护、需求拆分为故事、版本排期、影响模块标注 |
| `skills/xcart-task-management/SKILL.md` | 任务生命周期、`task next` 可执行任务、CAS 并发认领、统计与历史 |
| `skills/xcart-technical-constitution/SKILL.md` | 技术宪法：读取当前态/回溯演进历史、创建 ADR、维护模块目录 |

一键安装到 Claude Code（`xcart` 面向 Claude Code 优化；`--dir` 可自定义安装目录）：

```bash
xcart skill install            # 默认安装到仓库内 .claude/skills
xcart skill install --dir <path>   # 或自定义目标目录（如 ~/.claude/skills）
```

## 设计哲学

X-Cartographer 是**纯存储与协调层**，**不内置任何 LLM/AI 处理能力**。智能（需求分析、故事拆解、里程碑排期等）由**外部 Agent** 通过 `xcart` CLI + Skills 驱动，调用现有 `create / update / bulk-create` 命令把结果写回。

```
┌─────────────────────────┐
│  外部 AI Agent          │
│  (Claude Code / OpenCode │
│   / Cursor / 自建)      │
│  + xcart CLI + Skills   │
└────────────┬────────────┘
             │ xcart create / update / bulk-create
             ▼
┌─────────────────────────┐
│  X-Cartographer         │
│  REST + CLI             │
│  (纯数据/协调层)         │
└─────────────────────────┘
```

## 许可证

（按需补充）

## Docker 部署（x99）

参照 x-herald 形态：源码构建发布到 GHCR，`~/Docker/x-cartographer` 用 compose 部署，连接外部 PostgreSQL。

### CI 自动发布（GitHub Actions）

`.github/workflows/docker-build.yml`（参照 x-herald）：

- **build**：`ubuntu-latest` 构建 multi-arch（amd64/arm64）镜像并推送 `ghcr.io/xartifact/x-cartographer:{latest|alpha|branch|sha}`（build 需要 `packages: write` 权限）
- **deploy**：`runs-on: self-hosted`，由 x99 上的 runner 拉镜像 → `docker compose up -d` → 健康检查（容器内 `:8787/health`）
- **notify**：部署完成发 Discord 通知（`secrets.DISCORD_WEBHOOK`）

### 前置：x99 自托管 runner 授权（一次性，需 org admin）

x99-arch-server runner 注册在 **org 级 runner 组**（gitHubUrl 显示为 `x-llm-gateway` 仓库，实际是 org 共享）。runner 组默认只对部分仓库可见，**x-cartographer 未在可见列表**，导致 deploy job 无限 queued。

修复（任选其一）：

**UI**：GitHub → `xartifact` org → Settings → Actions → Runners → 找到 `x99-arch-server` 所在组 → Repository access → **Add repository** → 勾选 `x-cartographer` → Save。

**CLI**（需 `admin:org` scope）：
```bash
gh auth refresh -h github.com -s admin:org
# 查看 runner 组 id 与当前可见仓库
gh api orgs/xartifact/actions/runner-groups
# 把 x-cartographer 加入 Default 组（<gid> 替换为实际 id）
gh api -X POST orgs/xartifact/actions/runner-groups/<gid>/repositories \
  -H "Accept: application/vnd.github+json" -f repository_id=<repo_id>
```

同理，notify 用到的 `DISCORD_WEBHOOK` secret 需在 **x-cartographer 仓库**添加（org Settings → Secrets → Actions → 添加）。

### 手动部署（CI 未生效时的过渡方式）

```bash
# x99 上
mkdir -p ~/Docker/x-cartographer
# 从仓库拷贝 Dockerfile / docker-compose.yml / .env.example.x99 → .env（改 DB_*）
docker pull ghcr.io/xartifact/x-cartographer:latest
cd ~/Docker/x-cartographer && docker compose up -d
curl http://localhost:8787/health   # {"status":"ok"}
```

### 外部 PostgreSQL

复用 x99 共享 postgresql 实例（`postgresql-db-1`，Postgres 18，`example` 用户）。`.env` 配置 `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`，compose 拼成 `DATABASE_URL`。首次部署时 `ensureDb()` 自动跑 `TABLE_SQLS` 建表（drizzle 幂等 DDL），无需手动迁移。
