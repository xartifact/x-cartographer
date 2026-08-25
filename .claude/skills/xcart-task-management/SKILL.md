---
name: xcart-task-management
description: 在 X-Cartographer 中管理用户故事拆解出的研发任务：创建/查询/更新任务、推进任务状态、获取下一个可执行任务、查看状态历史与任务统计。当 agent 需要执行或协调研发任务时使用。
---

# X-Cartographer 任务管理

本 skill 教你用 xcart CLI 操作**任务（task）**生命周期：从故事拆解任务，推进状态，识别"下一个可执行任务"。

## 命令

```bash
xcart task list --story <storyId>
xcart task info <taskId>
xcart task create --story <storyId> --title <t> [--type user_story|technical_task|bug_fix|spike] [--priority P0|P1|P2|P3] [--estimation <h>] [--description] [--deps id1,id2] [--tags a,b]
xcart task update <taskId> [--title] [--priority] [--type] [--estimation] [--assignee] [--status] [--tags]
xcart task status <taskId> <status> [--reason]       # backlog|todo|in_progress|in_review|testing|done|cancelled
xcart task next --project <projectId> [--assignee]   # 下一个可执行任务（仅 todo 且依赖已完成）
xcart task summary --project <projectId>             # 任务状态统计/完成率
xcart task bulk-create --story <storyId> --file tasks.json
xcart status history <taskId>                        # 状态变更历史（含原因/变更人）
```

## 前置条件

- X-Cartographer gateway 需在运行（默认 `http://localhost:8787`）。
- 认证：若 gateway 已启用 API Token，通过 `--token <token>` 或环境变量 `XCART_API_TOKEN` 提供；未配置 token 时免认证（本地开发）。
- 服务地址：`--server <url>` 或环境变量 `XCART_API_URL` 覆盖默认值。
- 输出：加 `--format json` 获得可解析 JSON（脚本/agent 解析推荐）；默认 table。

## 关键语义（务必遵守）

- **新任务默认为 `backlog`**。只有进入 `todo` 且所有 `--deps` 依赖已完成的任务才会被 `task next` 返回。
- 推进流程建议：`backlog → todo`（就绪）→ `in_progress`（执行）→ `in_review → testing` → `done`；失败可 `cancelled`。每次变更可带 `--reason` 记录原因（写入 status history）。

## 典型工作流

1. **找活干**：`xcart task next --project <projectId>` → 若无候选，先把某个 backlog 任务置为 `todo`（`task status <id> todo`）。
2. **认领**：`xcart task update <taskId> --assignee <name> --status in_progress`。
3. **完成**：`xcart task status <taskId> done --reason "实现完成"`。
4. **回顾**：`xcart status history <taskId>` 看变更轨迹；`xcart task summary --project <id>` 看整体进度。

## 校验值

- `type`: `user_story | technical_task | bug_fix | spike`
- `priority`: `P0(P0) | P1(P1) | P2(P2) | P3(P3)`
- `status`: `backlog | todo | in_progress | in_review | testing | done | cancelled`


## Agent 效率提示（数据统计与解析）

- 统计用 `overview --format json`（一次 API 完成，**不要**逐 story 拉 task list 凑数——树内含完整任务明细）
- 解析 CLI 输出优先用 **jq**（1 行指令、失败面窄），不要写 python/node 内联脚本：
  ```bash
  xcart project list --format json | jq -r '.[] | "\(.id) \(.name)"'
  ```
- 复杂多步转换才用脚本，且写成文件而非内联 heredoc
- 评测依据与数据：`tools/bench-parse.ts`（可重跑）+ 结论见 `docs/cli-agent-usage.md`
