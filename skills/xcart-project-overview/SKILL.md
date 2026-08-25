---
name: xcart-project-overview
description: 查询 X-Cartographer 项目整体结构与上下文。当 agent 需要了解有哪些项目、查看某个项目的旅程/故事/版本布局、或导出项目全景 Markdown 供 LLM 评审/规划时使用。通过 xcart CLI 与 Gateway REST API 交互。
---

# X-Cartographer 项目全景

X-Cartographer 是一个 AI-Native 的研发需求与任务管理工具：以用户旅程（journey）为单位组织用户故事（story），故事拆解为任务（task），并按版本（milestone）排期。

本 skill 教你**读取**项目全局信息并向外部 LLM 提供评审上下文。

## 命令

```bash
xcart project list                       # 所有项目（id/name/description/journeys 数）
xcart project info --id <projectId>      # 单个项目详情（含 journeys + milestones）
xcart journey list --project <projectId> # 某项目的所有旅程
xcart milestone list --project <projectId> # 某项目的所有版本
xcart overview --project <projectId>     # 项目总览：旅程/故事/任务数、完成情况、状态分布
xcart context export <projectId>         # 导出全景 Markdown（需求/故事/任务/排期统计）
```

## 前置条件

- X-Cartographer gateway 需在运行（默认 `http://localhost:8787`）。
- 认证：若 gateway 已启用 API Token，通过 `--token <token>` 或环境变量 `XCART_API_TOKEN` 提供；未配置 token 时免认证（本地开发）。
- 服务地址：`--server <url>` 或环境变量 `XCART_API_URL` 覆盖默认值。
- 输出：加 `--format json` 获得可解析 JSON（脚本/agent 解析推荐）；默认 table。

## 典型工作流

1. **发现项目**：`xcart project list` → 选中目标 `projectId`。
2. **理解结构**：`xcart project info --id <id>` 查看旅程布局；`xcart journey list` / `xcart milestone list` 加深。
3. **提供评审上下文**：`xcart context export <projectId>`（Markdown）→ 直接粘贴给 LLM。
4. **机械读取**：所有命令加 `--format json` 以 JSON 解析。

## 效率提示（agent 用）

- `overview --format json` 返回结构化统计（`{ journeys, stories, tasks, task_status, ... }`），单次 API 完成，**不要**逐个 story 拉 `task list` 凑统计。
- `context export <id>` 默认输出 Markdown（`--format json` 得结构数据）；树内已含任务明细，无需再查 `task list`。
- `project list` 的 description 截断至 60 字；查全量描述用 `project info --id`。
## 输出契约（--format json 片段）

`project list` → `[{ "id", "name", "description"(截断), "journeys" }]`
`overview` → `{ "project_id", "name", "journeys", "stories", "done_stories", "tasks", "done_tasks", "task_status", "story_status" }`
`context export`：默认 Markdown；`--format json` → `{ "project"(精简), "milestones", "journeys"(树含故事任务) }`


## Agent 效率提示（数据统计与解析）

- 统计用 `overview --format json`（一次 API 完成，**不要**逐 story 拉 task list 凑数——树内含完整任务明细）
- 解析 CLI 输出优先用 **jq**（1 行指令、失败面窄），不要写 python/node 内联脚本：
  ```bash
  xcart project list --format json | jq -r '.[] | "\(.id) \(.name)"'
  ```
- 复杂多步转换才用脚本，且写成文件而非内联 heredoc
- 评测依据与数据：`tools/bench-parse.ts`（可重跑）+ 结论见 `docs/cli-agent-usage.md`
