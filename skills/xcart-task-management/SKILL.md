---
name: xcart-task-management
description: 在 X-Cartographer 中管理用户故事拆解出的研发任务（dev task）：创建/查询/更新任务、推进任务状态、获取下一个可执行任务、查看状态历史与任务统计。当 agent 需要执行或协调研发任务时使用。
---

# X-Cartographer 任务管理

本 skill 教你用 xcart CLI 操作**研发任务（dev task）**生命周期：从用户故事拆解研发任务，推进状态，识别"下一个可执行任务"。概念权威定义见 `docs/design/domain-model.md`——研发任务属**工作空间**（我们将采取什么行动），与用户任务（UserTask，属约束空间·意图）是不同空间的实体，永远不共用词汇。

## 命令

```bash
# 两种锚定（domain-model §2.5）：① --story = 有用户价值的工作项
#                          ② --product + --module-id = 工程治理类（重构/技术债，不进故事地图）
xcart dev-task list --story <storyId> | --product <productId> | --module-id <slug>
xcart task info <taskId>
xcart task create --story <storyId> --title <t> [--priority P0|P1|P2|P3] [--estimation <h>] [--description] [--deps id1,id2] [--tags a,b]
xcart task create --product <productId> --module-id <slug> --title <t> [--priority] [--estimation] [--tags a,b]
xcart task update <taskId> [--title] [--priority] [--estimation] [--assignee] [--tags] [--module-id <slug>] [--story <id>|none]
xcart task status <taskId> <status> [--expected-status <s>] [--reason]  # backlog|todo|in_progress|in_review|testing|done|cancelled
xcart task claim <taskId> --reason "<开始依据>"  # 原子认领：仅 todo 且依赖 done/cancelled 时转为 in_progress
xcart task next --project <projectId> [--assignee]   # 下一个可执行任务（仅 todo 且依赖已完成；两种锚定都参与）
xcart task summary --project <projectId>             # 任务状态统计/完成率（含 module_anchored 计数）
xcart task bulk-create --story <storyId> --file tasks.json | --product <productId> --module-id <slug> --file tasks.json
xcart status history <taskId>                        # 状态变更历史（含原因/变更人）
```

**`--module-id` vs `--affected-modules`**：前者是**唯一主锚**（这个工作项属于哪个模块），后者是**影响面标注**（可多个，信息性）。工程治理类任务用前者。

## 技术宪法纪律（先读后写）

实现/拆解前先执行 `xcart adr current --product <productId>`（或看 `xcart overview` 的 constitution 计数）确认架构约束；`[MUST]` 级原则直接约束本次实现方式。宪法未建立时（空数组）可建议负责人用 `xcart adr create` 沉淀首条决策。详见 skill `xcart-technical-constitution`。

## Agent 动工前检查（MUST）

在任何实现、代码修改或状态认领之前，Agent MUST 按以下顺序完成检查。它是工作流纪律，不伪装成服务端能够证明的“已理解”审批：

1. `xcart task next --project <productId>` 确认任务处于可执行候选；若由外部明确指定任务，仍须继续后续检查，且不得跳过依赖检查。
2. `xcart task info <taskId>` 确认任务仍为 `todo`、读取依赖、锚定（`story_id` 或 `product_id` + `module_id`）和 `architecture_context`。
3. 检查 `architecture_context.relevant_principles` 的每条 `[MUST]` / `[MUST_NOT]`；模块相关任务若缺少影响面标注，应先补齐 `affected_modules` 或在任务说明中说明无法标注的原因。
4. 故事锚定任务：从 task info 取得 `story_id` 后执行 `xcart story info <storyId>`，阅读 `acceptance_criteria`，把本任务将满足的条目和验证方式纳入实现计划。模块锚定任务没有故事 AC，改以任务描述定义可观察的完成条件。
5. 用原子命令认领：`xcart task claim <taskId> --reason "<开始依据>"`。服务端仅在任务为 `todo` 且依赖均为 `done` / `cancelled` 时转为 `in_progress`；收到 409 时，重新执行 `task info`；不得盲目重试或继续实现。

`task next` 是推荐发现入口；`task claim` 对状态与依赖提供原子服务端门禁。架构原则、验收标准是否已被理解只能由 Agent 的上述 preflight 和实际验证保证，当前不是 CLI 的拦截门禁。

## 前置条件

- X-Cartographer gateway 需在运行（默认 `http://localhost:8787`）。
- 认证：若 gateway 已启用 API Token，通过 `--token <token>` 或环境变量 `XCART_API_TOKEN` 提供；未配置 token 时免认证（本地开发）。
- 服务地址：优先写 `~/.config/xcart/config.toml` 的 `server = "<url>"`；`--server <url>` 可单次覆盖，其后才是环境变量 `XCART_API_URL` 与默认值。旧 `~/.config/xcart/config` 的 key=value 文件在首次运行时自动迁移为 TOML，旧文件保留。
- 输出：加 `--format json` 获得可解析 JSON（脚本/agent 解析推荐）；默认 table。

## 关键语义（务必遵守）

- **新任务默认为 `backlog`**。只有进入 `todo` 且所有 `--deps` 依赖已完成的任务才会被 `task next` 返回。
- **原子认领必须用 `task claim`**：服务端将 `todo` 状态和全部依赖为 `done` / `cancelled` 两项条件下推到同一条 SQL UPDATE；任一条件不满足返回 **409**（响应含 `current_status`）。收到 409 的正确反应是重新 `task info` 读取状态与依赖，再决定是否推进——**不要盲目重试**。`task status --expected-status` 仍用于其他需要 CAS 的状态流转，保持向后兼容。
- 推进流程建议：`backlog → todo`（就绪）→ `in_progress`（执行）→ `in_review → testing` → `done`；失败可 `cancelled`。每次变更可带 `--reason` 记录原因（写入 status history）。
- **动工前看 `task info` 的 `architecture_context`**（若非空）：它按模块范围过滤出该任务相关的架构原则（`relevant_principles`）与模块（`relevant_modules`），`[MUST]` 级尤其要遵守。**但这只是信息提示，不是拦截性门禁**——没有需要确认的清单，也不存在"未读宪法就不许完成任务"的机制（自证/复核机制已明确排除在技术宪法范围外）。原则为空通常意味着任务与故事都没标 `affected_modules`，而不是"没有约束"。
- **任务的架构上下文来源**：`task.affected_modules` → 回落 `story.affected_modules` → 回落 `task.module_id`；三者皆无则只剩全局原则。要让 `task info` 显示模块专属原则，拆解时就用 `story update --affected-modules` 或 `task update --affected-modules` 标注。

- **任务有两种锚定，都要会用**（`docs/design/domain-model.md` §2.5）：
  - **故事锚定**（默认）：有用户价值的工作项，`--story <id>`。产品归属经 `story → activity → product` 派生，出现在故事地图上。
  - **模块锚定**（工程治理类）：重构、技术债、架构一致性这类**用户不关心**的工作，用 `--product <id> --module-id <slug>`（`story_id` 为空）。产品归属靠 `product_id` 直连，**不出现在故事地图上**——不要为了让它可见而硬编进某个故事。
  - `task next` / `task summary` / `task list --product` / `context export` **都覆盖这两种锚定**；任务依赖也可以跨锚定（模块锚定任务依赖故事锚定任务，反之亦然）。


- **写 `--deps` 会被校验，违规直接 400**（`docs/design/domain-model.md` §2.4「必须无环」/ §5「无悬空」）：
  - **悬空**：依赖的任务必须存在，否则 `dangling_dependency` → 该任务会**永久不出队**（`next` 的完成集合永不含这个 ID）。
  - **自环**：任务不能依赖自身（`self_dependency`）。
  - **成环**：A→B 后再写 B→A（含间接 A→B→C→A）会被拒（`dependency_cycle`，报错给出环路径）。
  - 这三类是**结构性损坏**（任务永久不可执行），故拒绝写入——与 `affected_modules` 的「悬空只告警不阻断」不同。
  - 存量损坏用只读审计查看：`bun apps/server/scripts/audit-dependency-graph.ts [--server <url>]`（退出码 0 无问题 / 1 悬空或自环 / 2 有环 / 3 库为空）。
    悬空边清理：`bun apps/server/scripts/clean-dangling-deps.ts`；**环需人工裁定**删哪条边，服务端不自动改写。

## 典型工作流

1. **找活干**：`xcart task next --project <projectId>` → 若无候选，先把某个 backlog 任务置为 `todo`（`task status <id> todo`）。
2. **认领**：完成动工前检查后，`xcart task claim <taskId> --reason "依赖完成，开始实现"`。
3. **完成**：`xcart task status <taskId> done --reason "实现完成"`。
4. **回顾**：`xcart status history <taskId>` 看变更轨迹；`xcart task summary --project <id>` 看整体进度。

## 排期评估（AI-Native 研发工时）

- `estimation` 单位 = **AI-Native 研发工时（小时）**：按 coding agent 执行评估，**不是**人工人天/人月排期。
- 任务粒度 2-4h/个；征询/填写 estimation 时按 agent 执行速度评估，而非人工估算。
- 参照基准（agent 实际执行经验）：
  - 简单任务 2-3h → 10-15 分钟
  - 中等任务 5-8h → 20-30 分钟
  - 复杂任务 13h+ → 40-60 分钟
  - 完整模块 → 1-2 小时
- 排期容量：一个 coding agent 一天可承载的 AI-Native 工时显著高于人工排期；修订 estimation 与排期时保持该口径。

## 校验值

- `priority`: `P0 | P1 | P2 | P3`
- `status`: `backlog | todo | in_progress | in_review | testing | done | cancelled`

**无 `--type` 参数**——`type` 字段已废除（实体切割后分类价值失效），交付性质由 `--tags` 承载（惯例标签：`architecture-enabler` / `implementation` / `refactor` / `bug`）。

## Agent 效率提示（数据统计与解析）

- 统计用 `overview --format json`（一次 API 完成，**不要**逐 story 拉 task list 凑数——树内含完整任务明细）
- 解析 CLI 输出优先用 **jq**（1 行指令、失败面窄），不要写 python/node 内联脚本：
  ```bash
  xcart project list --format json | jq -r '.[] | "\(.id) \(.name)"'
  ```
- 复杂多步转换才用脚本，且写成文件而非内联 heredoc
- 评测依据与数据：`tools/bench-parse.ts`（可重跑）+ 结论见 `docs/cli-agent-usage.md`
