---
name: xcart-project-overview
description: 查询 X-Cartographer 产品整体结构与上下文。当 agent 需要了解有哪些产品、查看某个产品的活动/故事/版本布局、或导出产品全景 Markdown 供 LLM 评审/规划时使用。通过 xcart CLI 与 Gateway REST API 交互。
---

# X-Cartographer 产品全景

X-Cartographer 是一个 AI-Native 的研发需求与任务管理工具：以用户活动（activity，故事地图骨干）为单位组织用户故事（story），故事拆解为研发任务（dev task），并按版本（milestone）排期。概念权威定义见 `docs/design/domain-model.md`（域划分：约束/工作/证据）与 `docs/design/story-map-redesign.md`（实体语义）。

本 skill 教你**读取**产品全局信息并向外部 LLM 提供评审上下文。

## 命令

```bash
xcart product list                       # 所有产品（id/name/description/活动数）
xcart project info --id <productId>      # 单个产品详情（含活动 + 版本）
xcart activity list --product <productId>    # 某产品的所有活动（journey 为 deprecated alias）
xcart milestone list --project <productId>   # 某产品的所有版本
xcart overview --project <productId>     # 产品总览：活动/故事/任务数、完成情况、状态分布、宪法计数
xcart context export <productId>         # 导出全景 Markdown（含技术宪法节：技术栈/架构原则/模块目录）
xcart adr current --project <productId>  # 当前生效技术宪法全文（原则/技术栈/模块）——了解技术基线
xcart trace <story|module|adr> <id>       # 约束追溯链：意图→结构→规矩→实现（纯读）
xcart skill list | install [--dir <p>]    # 列出/安装 skills/*.SKILL.md 到 agent 目录
```

## 技术宪法纪律（先读后写）

实现/拆解前先执行 `xcart adr current --product <productId>`（或看 `xcart overview` 的 constitution 计数）确认架构约束；`[MUST]` 级原则直接约束本次实现方式。宪法未建立时（空数组）可建议负责人用 `xcart adr create` 沉淀首条决策。详见 skill `xcart-technical-constitution`。

## 前置条件

- X-Cartographer gateway 需在运行（默认 `http://localhost:8787`）。
- 认证：若 gateway 已启用 API Token，通过 `--token <token>` 或环境变量 `XCART_API_TOKEN` 提供；未配置 token 时免认证（本地开发）。
- 服务地址：`--server <url>` 或环境变量 `XCART_API_URL` 覆盖默认值。
- 输出：加 `--format json` 获得可解析 JSON（脚本/agent 解析推荐）；默认 table。

## 典型工作流

1. **发现产品**：`xcart product list` → 选中目标 `productId`。
2. **理解结构**：`xcart project info --id <id>` 查看活动布局；`xcart activity list` / `xcart milestone list` 加深。
3. **了解技术基线**：`xcart overview` 看宪法计数（`constitution.principles_count`/`must_principles_count`）→ 有原则时用 `xcart adr current --product <id>` 看全文；`[MUST]` 级直接约束后续实现。
4. **提供评审上下文**：`xcart context export <productId>`（Markdown）→ 直接粘贴给 LLM；导出内容已含技术宪法节，无需另外拼接。
5. **追溯某条约束的来龙去脉**：`xcart trace <story|module|adr> <id>` 输出四段链（意图→结构→规矩→实现）——比逐个命令拼装快，且是「这条需求被哪些约束管着、落在哪些模块、由哪些任务实现」的主路径。
6. **机械读取**：所有命令加 `--format json` 以 JSON 解析。

> **保持本 skill 为最新**：skill 是 Agent 的唯一入口（P5），但副本可能落后于仓库源
> `skills/`。`xcart skill list` 查看已安装路径；`xcart skill install` 从源重新同步
> （默认装到 `~/.agents/skills`，`--dir <path>` 指定其他目录）。

## 效率提示（agent 用）

- `overview --format json` 返回结构化统计（`{ activities, stories, tasks, task_status, constitution, ... }`），单次 API 完成，**不要**逐个 story 拉 `task list` 凑统计。`constitution` 字段是宪法摘要计数（`principles_count`/`must_principles_count`/`tech_stack_count`/`modules_count`）——它只是**计数**，要看原则正文用 `xcart adr current`。
- `context export <id>` 默认输出 Markdown（`--format json` 得结构数据）；树内已含任务明细，无需再查 `task list`。Markdown 内含「技术宪法」节（技术栈/架构原则/模块目录），JSON 的 `constitution` 字段是三者的完整内容——因此导出的上下文**自带架构基线**，给 LLM 评审时不必另外附 ADR。
- `project list` 的 description 截断至 60 字；查全量描述用 `project info --id`。

## 排期评估（AI-Native 研发工时）

- 本项目 `estimation` / 排期统计的单位 = **AI-Native 研发工时（小时）**：按 coding agent 执行评估，**不是**人工人天/人月排期。
- 报告排期/容量时以 agent 口径解读数字：如某版本估算 40h，指 coding agent 的工作量，交付时长远小于人工排期。
- 参照基准（agent 实际执行经验）：
  - 简单任务 2-3h → 10-15 分钟
  - 中等任务 5-8h → 20-30 分钟
  - 复杂任务 13h+ → 40-60 分钟
  - 完整模块 → 1-2 小时
- 向 LLM 提供评审上下文时，指出估算基于 AI-Native 工作流评估，避免误读为人力排期。

## 版本目标写作纪律（milestone.goal 必须 SMART）

版本目标是**可判定是否达成**的承诺，不是愿望清单。评审/新建版本时按此把关：

| ✅ 正例 | ❌ 反例 | 问题 |
|---|---|---|
| 各旅程核心能力落地：故事地图、任务管理、排期、CLI/API 集成 | 把产品做得更好用 | 无法判定达成 |
| 第三方可开发插件：共享打包预设、开发文档、运行时装卸载与 HMR | 完善插件生态 | 无边界（"完善"没有终点） |
| 进行中功能收尾 + 新流程需求：筛选/状态历史/文档/任务排期视图 | 提升系统质量 | 不可验收 |

判据：**看到 goal 能否写出退出信号**（"满足什么条件算完成"）。写不出就重写 goal。

配套指标：`xcart overview --format json` 的 `milestone_predictability` 给出每版本
planned vs done（故事数 + 估算工时，cancelled 已剔除）——**目标是承诺、比值是兑现情况**，
两者一起看才能校准后续版本规划（US-112 PI 可预测性）。

## 输出契约（--format json 片段）

`project list` → `[{ "id", "name", "description"(截断), "activities" }]`
`overview` → `{ "project_id", "name", "activities", "stories", "done_stories", "tasks", "done_tasks", "task_status", "story_status", "constitution": { "tech_stack_count", "principles_count", "must_principles_count", "modules_count" } }`
`context export`：默认 Markdown（含技术宪法节）；`--format json` → `{ "product"(精简), "milestones", "constitution"(完整:{tech_stack,architecture_principles,modules}), "activities"(树含故事任务) }`


## Agent 效率提示（数据统计与解析）

- 统计用 `overview --format json`（一次 API 完成，**不要**逐 story 拉 task list 凑数——树内含完整任务明细）
- 解析 CLI 输出优先用 **jq**（1 行指令、失败面窄），不要写 python/node 内联脚本：
  ```bash
  xcart project list --format json | jq -r '.[] | "\(.id) \(.name)"'
  ```
- 复杂多步转换才用脚本，且写成文件而非内联 heredoc
- 评测依据与数据：`tools/bench-parse.ts`（可重跑）+ 结论见 `docs/cli-agent-usage.md`
