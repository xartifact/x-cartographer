---
name: xcart-project-overview
description: 查询 X-Cartographer 产品整体结构与上下文。当 agent 需要了解有哪些产品、查看某个产品的用户活动/故事/发布布局、或导出产品全景 Markdown 供 LLM 评审/规划时使用。通过 xcart CLI 与 Gateway REST API 交互。
---

# X-Cartographer 产品全景

X-Cartographer 是一个 AI-Native 的需求管理工具：以用户故事地图组织需求——横轴为用户活动（activity，backbone 骨干），同列纵向按深度排列用户故事（story），故事切片按发布（release）排期，发布内的故事拆解为研发任务（dev task）执行。

本 skill 教你**读取**产品全局信息并向外部 LLM 提供评审上下文。

> 术语与概念权威定义见 docs/design/story-map-redesign.md。

## 术语速查表

| 旧 | 新 |
|---|---|
| 项目 / Project | 产品 / Product |
| 用户旅程 / Journey | 用户活动 / UserActivity（backbone，动词短语命名） |
| 任务 / Task | 研发任务 / DevTask（解空间；用户任务 UserTask 是问题空间，两者不共用词汇） |
| 里程碑 / 版本 Milestone | 发布（Release 切片） |
| — | 用户任务 / UserTask（活动下的用户操作步骤，新） |
| — | 行走骨架 walking skeleton（每列深度序最前、能端到端打通的最少切片） |

## 命令

```bash
xcart product list                          # 所有产品（id/name/description/activities 数）
xcart product info --id <productId>         # 单个产品详情（含 activities + milestones）
xcart activity list --product <productId>   # 某产品的所有用户活动（backbone，按叙事序）
xcart milestone list --product <productId>  # 某产品的所有发布（Release 切片）
xcart overview --product <productId>        # 产品总览：活动/故事/研发任务数、完成情况、状态分布
xcart context export <productId>            # 导出全景 Markdown（活动/故事/研发任务/排期统计）
```

## 前置条件

- X-Cartographer gateway 需在运行（默认 `http://localhost:8787`）。
- 认证：若 gateway 已启用 API Token，通过 `--token <token>` 或环境变量 `XCART_API_TOKEN` 提供；未配置 token 时免认证（本地开发）。
- 服务地址：`--server <url>` 或环境变量 `XCART_API_URL` 覆盖默认值。
- 输出：加 `--format json` 获得可解析 JSON（脚本/agent 解析推荐）；默认 table。

## 典型工作流

1. **发现产品**：`xcart product list` → 选中目标 `productId`。
2. **理解地图结构**：`xcart product info --id <id>` 查看用户活动（backbone）布局；`xcart activity list` / `xcart milestone list` 加深。
3. **提供评审上下文**：`xcart context export <productId>`（Markdown）→ 直接粘贴给 LLM。
4. **机械读取**：所有命令加 `--format json` 以 JSON 解析。

## 效率提示（agent 用）

- `overview --format json` 返回结构化统计（`{ activities, stories, dev_tasks, dev_task_status, ... }`），单次 API 完成，**不要**逐个 story 拉 `dev-task list` 凑统计。
- `context export <id>` 默认输出 Markdown（`--format json` 得结构数据）；树内已含研发任务明细，无需再查 `dev-task list`。
- `product list` 的 description 截断至 60 字；查全量描述用 `product info --id`。

## 排期评估（AI-Native 研发工时）

- 本产品 `estimation` / 排期统计的单位 = **AI-Native 研发工时（小时）**：按 coding agent 执行评估，**不是**人工人天/人月排期。
- 报告排期/容量时以 agent 口径解读数字：如某个发布切片估算 40h，指 coding agent 的工作量，交付时长远小于人工排期。
- 参照基准（agent 实际执行经验）：
  - 简单研发任务 2-3h → 10-15 分钟
  - 中等研发任务 5-8h → 20-30 分钟
  - 复杂研发任务 13h+ → 40-60 分钟
  - 完整模块 → 1-2 小时
- 向 LLM 提供评审上下文时，指出估算基于 AI-Native 工作流评估，避免误读为人力���期。

## 输出契约（--format json 片段）

`product list` → `[{ "id", "name", "description"(截断), "activities" }]`
`overview` → `{ "product_id", "name", "activities", "stories", "done_stories", "dev_tasks", "done_dev_tasks", "dev_task_status", "story_status" }`
`context export`：默认 Markdown；`--format json` → `{ "product"(精简), "milestones", "activities"(树：活动→用户任务/故事→研发任务) }`

## 兼容性（旧命令别名）

- 旧命令 `project` 一个版本内仍可作为 `product` 的别名；新脚本/agent 一律用 `product`。
- 旧 `journey` 命令已随用户旅程实体退役，执行会返回迁移提示（旅程语义已分流：地图位置 → 用户活动，功能域内容 → 按主题归入活动）。

## Agent 效率提示（数据统计与解析）

- 统计用 `overview --format json`（一次 API 完成，**不要**逐 story 拉 dev-task list 凑数——树内含完整研发任务明细）
- 解析 CLI 输出优先用 **jq**（1 行指令、失败面窄），不要写 python/node 内联脚本：
  ```bash
  xcart product list --format json | jq -r '.[] | "\(.id) \(.name)"'
  ```
- 复杂多步转换才用脚本，且写成文件而非内联 heredoc
- 评测依据与数据：`tools/bench-parse.ts`（可重跑）+ 结论见 `docs/cli-agent-usage.md`
