---
name: xcart-task-management
description: 在 X-Cartographer 中管理用户故事拆解出的研发任务（DevTask）：创建/查询/更新研发任务、推进任务状态、获取下一个可执行任务、查看状态历史与任务统计。当 agent 需要执行或协调研发任务时使用。
---

# X-Cartographer 研发任务管理

本 skill 教你用 xcart CLI 操作**研发任务（dev task）**生命周期：从用户故事拆解研发任务，推进状态，识别"下一个可执行任务"。

> 术语与概念权威定义见 docs/design/story-map-redesign.md。研发任务（DevTask，解空间：我们要做什么）与用户任务（UserTask，问题空间：用户要完成什么）是不同世界的实体，永远不共用词汇。

## 命令

```bash
xcart dev-task list --story <storyId>
xcart dev-task info <devTaskId>
xcart dev-task create --story <storyId> --title <t> [--priority P0|P1|P2|P3] [--estimation <h>] [--description] [--deps id1,id2] [--tags a,b]
xcart dev-task update <devTaskId> [--title] [--priority] [--estimation] [--assignee] [--status] [--tags]
xcart dev-task status <devTaskId> <status> [--reason]    # backlog|todo|in_progress|in_review|testing|done|cancelled
xcart dev-task next --product <productId> [--assignee]   # 下一个可执行研发任务（仅 todo 且依赖已完成）
xcart dev-task summary --product <productId>             # 研发任务状态统计/完成率
xcart dev-task bulk-create --story <storyId> --file dev-tasks.json
xcart status history <devTaskId>                         # 状态变更历史（含原因/变更人）
```

> 旧命令 `task` 一个版本内仍可作为 `dev-task` 的别名；新脚本/agent 一律用 `dev-task`。

## 交付性质用 tags（type 字段已废除）

`type` 字段（原 `user_story | technical_task | bug_fix | spike` 分类）已废除。任务的交付性质用 `--tags` 承载（可多值叠加），既有惯例标签：

- `implementation`：功能实现
- `refactor`：重构
- `bug`：缺陷修复
- `infra`：基础设施（如 `architecture-enabler` 架构使能）
- 其余为团队自定义标签，按需追加；同一任务可带多个性质标签。

## 前置条件

- X-Cartographer gateway 需在运行（默认 `http://localhost:8787`）。
- 认证：若 gateway 已启用 API Token，通过 `--token <token>` 或环境变量 `XCART_API_TOKEN` 提供；未配置 token 时免认证（本地开发）。
- 服务地址：`--server <url>` 或环境变量 `XCART_API_URL` 覆盖默认值。
- 输出：加 `--format json` 获得可解析 JSON（脚本/agent 解析推荐）；默认 table。

## 关键语义（务必遵守）

- **新任务默认为 `backlog`**。只有进入 `todo` 且所有 `--deps` 依赖已完成的任务才会被 `dev-task next` 返回。
- 推进流程建议：`backlog → todo`（就绪）→ `in_progress`（执行）→ `in_review → testing` → `done`；失败可 `cancelled`。每次变更可带 `--reason` 记录原因（写入 status history）。

## 典型工作流

1. **找活干**：`xcart dev-task next --product <productId>` → 若无候选，先把某个 backlog 任务置为 `todo`（`dev-task status <id> todo`）。
2. **认领**：`xcart dev-task update <devTaskId> --assignee <name> --status in_progress`。
3. **完成**：`xcart dev-task status <devTaskId> done --reason "实现完成"`。
4. **回顾**：`xcart status history <devTaskId>` 看变更轨迹；`xcart dev-task summary --product <id>` 看整体进度。

## 排期评估（AI-Native 研发工时）

- `estimation` 单位 = **AI-Native 研发工时（小时）**：按 coding agent 执行评估，**不是**人工人天/人月排期。
- 研发任务粒度 2-4h/个；征询/填写 estimation 时按 agent 执行速度评估，而非人工估算。
- 参照基准（agent 实际执行经验）：
  - 简单任务 2-3h → 10-15 分钟
  - 中等任务 5-8h → 20-30 分钟
  - 复杂任务 13h+ → 40-60 分钟
  - 完整模块 → 1-2 小时
- 排期容量：一个 coding agent 一天可承载的 AI-Native 工时显著高于人工排期；修订 estimation 与排期时保持该口径。

## 校验值

- `priority`: `P0 | P1 | P2 | P3`
- `status`: `backlog | todo | in_progress | in_review | testing | done | cancelled`
- 交付性质（tags，非校验字段）：`implementation | refactor | bug | infra` 等自定义标签

## Agent 效率提示（数据统计与解析）

- 统计用 `overview --format json`（一次 API 完成，**不要**逐 story 拉 dev-task list 凑数——树内含完整研发任务明细）
- 解析 CLI 输出优先用 **jq**（1 行指令、失败面窄），不要写 python/node 内联脚本：
  ```bash
  xcart dev-task next --product <id> --format json | jq -r '.[0] | "\(.id) \(.title)"'
  ```
- 复杂多步转换才用脚本，且写成文件而非内联 heredoc
- 评测依据与数据：`tools/bench-parse.ts`（可重跑）+ 结论见 `docs/cli-agent-usage.md`
