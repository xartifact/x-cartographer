---
name: xcart-task-management
description: 在 X-Cartographer 中管理用户故事拆解出的研发任务（dev task）：创建/查询/更新任务、推进任务状态、获取下一个可执行任务、查看状态历史与任务统计。当 agent 需要执行或协调研发任务时使用。
---

# X-Cartographer 任务管理

本 skill 教你用 xcart CLI 操作**研发任务（dev task）**生命周期：从用户故事拆解研发任务，推进状态，识别"下一个可执行任务"。概念权威定义见 `docs/design/domain-model.md`——研发任务属**工作空间**（我们将采取什么行动），与用户任务（UserTask，属约束空间·意图）是不同空间的实体，永远不共用词汇。

## 命令

```bash
xcart dev-task list --story <storyId>
xcart task info <taskId>
xcart task create --story <storyId> --title <t> [--priority P0|P1|P2|P3] [--estimation <h>] [--description] [--deps id1,id2] [--tags a,b]
xcart task update <taskId> [--title] [--priority] [--estimation] [--assignee] [--status] [--tags]
xcart task status <taskId> <status> [--expected-status <s>] [--reason]  # backlog|todo|in_progress|in_review|testing|done|cancelled
xcart task next --project <projectId> [--assignee]   # 下一个可执行任务（仅 todo 且依赖已完成）
xcart task summary --project <projectId>             # 任务状态统计/完成率
xcart task bulk-create --story <storyId> --file tasks.json
xcart status history <taskId>                        # 状态变更历史（含原因/变更人）
```

## 技术宪法纪律（先读后写）

实现/拆解前先执行 `xcart adr current --product <productId>`（或看 `xcart overview` 的 constitution 计数）确认架构约束；`[MUST]` 级原则直接约束本次实现方式。宪法未建立时（空数组）可建议负责人用 `xcart adr create` 沉淀首条决策。详见 skill `xcart-technical-constitution`。

## 前置条件

- X-Cartographer gateway 需在运行（默认 `http://localhost:8787`）。
- 认证：若 gateway 已启用 API Token，通过 `--token <token>` 或环境变量 `XCART_API_TOKEN` 提供；未配置 token 时免认证（本地开发）。
- 服务地址：`--server <url>` 或环境变量 `XCART_API_URL` 覆盖默认值。
- 输出：加 `--format json` 获得可解析 JSON（脚本/agent 解析推荐）；默认 table。

## 关键语义（务必遵守）

- **新任务默认为 `backlog`**。只有进入 `todo` 且所有 `--deps` 依赖已完成的任务才会被 `task next` 返回。
- 推进流程建议：`backlog → todo`（就绪）→ `in_progress`（执行）→ `in_review → testing` → `done`；失败可 `cancelled`。每次变更可带 `--reason` 记录原因（写入 status history）。
- **并发认领必须用 CAS**：多 Agent 协作时，认领/流转加 `--expected-status <当前状态>`。服务端把条件推到 SQL WHERE（`packages/db/src/repositories/dev-task.repository.ts` 的 `compareAndSetStatus`），不匹配时返回 **409**（响应含 `current_status`）。收到 409 的正确反应是**重新 `task info` 读取当前状态**再决定是否推进——**不要盲目重试**：两个 Agent 都重试会让双方都以为拿到了独占任务，重复推进同一份工作。不加 `--expected-status` 时行为不变（无条件流转，向后兼容）。
- **动工前看 `task info` 的 `architecture_context`**（若非空）：它按模块范围过滤出该任务相关的架构原则（`relevant_principles`）与模块（`relevant_modules`），`[MUST]` 级尤其要遵守。**但这只是信息提示，不是拦截性门禁**——没有需要确认的清单，也不存在"未读宪法就不许完成任务"的机制（自证/复核机制已明确排除在技术宪法范围外）。原则为空通常意味着任务与故事都没标 `affected_modules`，而不是"没有约束"。
- **任务的架构上下文来源**：`task.affected_modules` → 回落 `story.affected_modules` → 回落 `task.module_id`；三者皆无则只剩全局原则。要让 `task info` 显示模块专属原则，拆解时就用 `story update --affected-modules` 或 `task update --affected-modules` 标注。

## 典型工作流

1. **找活干**：`xcart task next --project <projectId>` → 若无候选，先把某个 backlog 任务置为 `todo`（`task status <id> todo`）。
2. **认领**：`xcart task update <taskId> --assignee <name> --status in_progress`。
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
