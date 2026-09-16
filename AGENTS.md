<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **x-cartographer** (2346 symbols, 4367 relationships, 185 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "feat/core"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/x-cartographer/context` | Codebase overview, check index freshness |
| `gitnexus://repo/x-cartographer/clusters` | All functional areas |
| `gitnexus://repo/x-cartographer/processes` | All execution flows |
| `gitnexus://repo/x-cartographer/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

<!-- xcart:start -->
# X-Cartographer 任务板自管理

本仓库自身以 **xcart** 产品（`X-Cartographer-Dev`，id `PROD-002`）管理研发任务。开发/修 bug/加功能前，先查任务板认领与跟进对应任务，完成或失败后更新状态（带 `--reason`）。

## 前置

- Gateway：`bun run --cwd apps/server dev`（默认 `http://localhost:8787`；本会话可用 my xcart-gateway hub 服务）
- CLI：全局 `xcart`（仓库内亦可 `bun run --cwd apps/cli src/index.ts`）
- 认证：开发模式免 token；已配置则用 `XCART_API_TOKEN` 或 `--token`
- 服务地址：CLI 默认读 `~/.config/xcart/config`（`server=...`），未配置时 `$XCART_API_URL` → `http://localhost:8787`
- Skills：读取 `.claude/skills/xcart-*/SKILL.md` 获取命令细节

## 常用操作（注意：板命令走生产网关，部署新 server 前用 `task` 而非 `dev-task`）

> **部署状态**：上表 ID（`PROD-002`）与 `dev-task` 命令树对应**新代码**。生产网关
> （`100.80.110.125:8787`）尚未部署，仍返回旧 ID 与旧命令树——部署前板命令请用旧
> 形态（`xcart task ... --project 69hKGAjvxjf6QVQu6DtZx`）。

```bash
xcart dev-task summary --product PROD-002     # 进度总览（task 为 deprecated alias）
xcart dev-task next --product PROD-002       # 下一个可执行任务
xcart dev-task info <taskId>
xcart dev-task status <taskId> in_progress --reason "认领"
xcart dev-task status <taskId> done --reason "实现完成"
xcart status history <taskId>
xcart overview --product PROD-002
xcart context export PROD-002                # 全景 Markdown 供 LLM
```

## 状态事实（以任务板实时数据为准）

- 150 任务：done 100 / todo 5 / backlog 40 / cancelled 19（2026-08-25 复核）
- `todo` 是可实现候选；`cancelled` = **架构决策废弃（内置 LLM 移除；MCP Server 已评估并否决，不实现）**，勿当作待办
- 状态以 `xcart task summary` / `task info` 实时查询为准；US-044/046/047（API Token/CLI/上下文导出）已实现为 done
- 依赖关系已按真实任务 ID 写入；`task next` 只推荐依赖已完成且为 todo 的任务

## 更新任务板的约定

- **先查板再动手**：`task next` 或 `task list --story` 找到对应任务；没有则用 `task create` 建（默认 backlog）
- **状态必须带 `--reason`**：写清依据（如「实现 X 模块」「架构决策移除」）
- **完成闭环**：实现完 → `task status <id> done --reason "…"`；放弃/废弃 → `cancelled`


<!-- xcart:end -->

<!-- dev-constraints:start -->
# X-Cartographer 开发约束

> 开发流程的可执行约束。既有 GitNexus（代码智能/影响分析）与 x-cart（任务板自管理）章节见上；此处补充**实操规则**。

## 技术栈与运行时

- **Bun 运行时 + pnpm 依赖管理**（仓库根 `bun.lock`；勿引入 npm 新增包）。
- Monorepo：`apps/web`（React + TanStack Router + Vite）、`apps/server`（Hono + PGlite + Drizzle）、`apps/cli`（xcart CLI）、`packages/{db,shared,ui}`。
- **禁内置 LLM 依赖**：项目定位为纯存储/协调层（`refactor: remove built-in AI`）。story/任务 AI 生成类需求按架构决策废弃，勿新建该类功能。**MCP Server 已评估并否决，��实现**——Agent 集成只走 `xcart` CLI + Agent Skills，勿为 MCP 预留设计。

## Entity Terminology

**Authoritative definitions**: domain division (constraint / work / evidence) in `docs/design/domain-model.md`; entity semantics and migration in `docs/design/story-map-redesign.md`.

Migration status: the entity model has switched to user-story-map semantics. Old and new coexist during transition:

| 旧 | 新 | 说明 |
|---|---|---|
| Project / 项目 | **Product / 产品** | `products` 表、`/api/products` |
| Journey / 用户旅程 | **UserActivity / 用户活动**（backbone） | `user_activities` 表；journey 已退役 |
| （无） | **UserTask / 用户任务** | `user_tasks` 表（活动下的用户操作步骤） |
| UserStory | UserStory（保留） | 改挂 `activity_id` + 可选 `user_task_id` |
| Task / 任务 | **DevTask / 研发任务** | `dev_tasks` 表；**type 字段已废除**（tags 承载性质） |

New code MUST use the new terminology. Legacy APIs (`/projects`, `/journeys`, `/tasks`) return 410.

### Domain Spaces (see `docs/design/domain-model.md` §2)

| Space | Entities | Change rule |
|---|---|---|
| **Constraint** | Product, UserActivity, UserTask, UserStory, AdrRecord, SystemModule | Low frequency; a change is a decision. High-impact writes need confirmation; agent-inferred writes carry `provenance` |
| **Work** | DevTask | High frequency; CAS claim; free writes |
| **Evidence** | StatusChange | Append-only; never rewritten |

Key constraints:

- **Constraint writes MUST carry `provenance`** (`human_asserted` | `agent_inferred` | `imported`) — see `domain-model.md` §3. Never record an agent inference as a human assertion.
- **Work MUST NOT write constraints** — DevTask never modifies stories or ADRs.
- **Evidence is append-only** — StatusChange rows are never updated.
- **No dangling refs, no dead columns** — a column with zero readers and zero writers MUST be deleted; it reads to an agent as a false claim about system capability (`domain-model.md` §5).

## UI 开发约束（web）

- **详情交互统一用 `Sheet` 抽屉**（`TaskDetailSheet` 范式，`@x-cartographer/ui` 的 `Sheet`/`SheetContent`）。避免自绘 `absolute` 浮层；roadmap 故事详情已统一为 Sheet（`StoryDetailPanel` 放入 `SheetContent`，经 `className` 覆盖宽度）。
- **卡片宽度由容器约束**：泳道/列表卡片用 `w-full` 铺满列内容区，列才是宽度唯一约束；勿给卡片固定宽（会溢出列 padding）。
- **版本/排期实体**：故事挂 `milestone_id`（版本），任务经 `story_id` 间接归属版本；任务无独立 `milestone_id`/`due_date`。研发任务排期视图按「故事→版本」聚合，非任务独立排期。
- **统一信息密度**：故事卡片复用 `StoryCard`（优先级左色条 + 状态徽章 + 估算 + 任务进度），与故事地图 `StoryNode` 一致。

## API 数据流约束

- **深树一次取全**：`GET /api/products/:id` 返回 `user_activities[].stories[].dev_tasks[]`（含 `story.milestone_id`）。统计/排期视图直接消费该树，**勿**逐 story 拉 `dev-task list` 凑数（有 N+1 前科，2026-09 又复现于 CLI `task summary`，已修）。注意深树字段名是 **`dev_tasks`**（非 `tasks`）。
- **API 输出形状一律 snake_case**：所有 `/api/*` 端点返回 snake_case 键（`story_id`/`affected_modules`）。请求体用 camelCase，由路由层映射到 DTO——**直接透传 input 会导致字段被仓库层静默丢弃**（dev-tasks PATCH 曾因此丢 `affectedModules`）。
- **CLI 与 web 数据一致性**：CLI 连 `~/.config/xcart/config` 的 gateway（生产 `http://100.80.110.125:8787`）；web 开发经 Vite proxy，目标由 `VITE_PROXY_TARGET`（`apps/web/.env`，已 gitignore）控制，`vite.config.ts` 用 `loadEnv` 读取。

## 本地开发环境

- Gateway：`bun run --cwd apps/server dev`（`:8787`）；Web：`bun run --cwd apps/web dev`（`:3001`）。
- 看生产数据 UI：`apps/web/.env` 写 `VITE_PROXY_TARGET=http://100.80.110.125:8787`（`.env` 被 gitignore，不入库）。

### 本地 PGlite 纪律（违反会导致数据丢失，已多次踩坑）

PGlite 是**嵌入式单实例**库（`apps/server/data/pglite`）。两个进程同时打开同一目录会触发 catalog 损坏与**静默重置**（数据全丢，无报错）。

1. **跑任何本地 DB 脚本前，必须先停 gateway**：
   ```bash
   lsof -ti :8787 | xargs kill; rm -f apps/server/data/pglite/postmaster.pid
   ```
   包括迁移脚本、诊断脚本、`bun -e` 直连——**任何**新进程打开该目录都算违规。
2. **验证 schema 变更时用非 watch 模式起服务**：`bun run --cwd apps/server src/index.ts`。
   `dev`（`--watch`）在 schema 变更后会保留**陈旧的 drizzle 模块状态**，表现为插入报错而独立进程同样代码正常。
3. **库损坏后的恢复**：停 gateway，然后
   `cd apps/server && bun scripts/sync-dev-db.ts http://100.80.110.125:8787`
   （从权威源重建；脚本会自动推进短 ID 序列，避免主键冲突）。
4. **迁移脚本分两类，勿混用**：
   - `run-migrate-story-map.ts` = 2026-09-10 故事地图重设计的**一次性编排**（含骨架重建），对已迁移库重跑会失败——这是设计如此。
   - `migrate-schema.ts` = **增量幂等 DDL**（新 schema 变更加这里），可对任意状态重跑。

## 代码质量门禁

- **验证链**：`tsc --noEmit`（web）→ `oxlint` → `bun run build`（web）→ `vitest run`（web）。既有测试勿破坏。
- **UI 改动必须浏览器实测**（browser 工具），截图证明视觉效果；纯逻辑改动跑测试。
- **提交信息**：`feat(web): …` / `fix(web): …`，中文描述，含改动要点。

<!-- dev-constraints:end -->
