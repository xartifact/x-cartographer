---
name: xcart-story-breakdown
description: 在 X-Cartographer 中维护用户活动（activity）与用户故事（story）：创建/查看/更新活动与故事、拆分需求为故事、批量导入、关联版本排期。当 agent 需要把需求转化为结构化用户故事地图时使用。
---

# X-Cartographer 故事拆解

本 skill 教你用 xcart CLI 操作**用户活动（activity，故事地图骨干）与用户故事（story，纵向切片）**，把自然语言需求逐步落成故事地图。概念权威定义见 `docs/design/domain-model.md`（域划分）与 `docs/design/story-map-redesign.md`（实体语义）。

## 命令

```bash
# 用户活动（活动=故事地图骨干列；`journey` 是 deprecated alias，新代码用 `activity`）
xcart activity list --product <productId>
xcart activity info <activityId>                      # 该活动下的故事（别名 journey info）
xcart activity create --product <id> --name <n> [--description] [--order]
xcart activity update <activityId> [--name] [--description] [--order]
xcart activity delete <activityId>

# 用户任务（活动下的操作步骤，故事地图第二层；正向推演先声明步骤）
xcart user-task list --activity <activityId>
xcart user-task create --activity <activityId> --name <n> [--description] [--order]
xcart user-task update <userTaskId> [--name] [--description] [--order]
xcart user-task delete <userTaskId>

# 故事
xcart story list --activity <activityId>              # 注意：--activity（活动），非 --journey
xcart story info <storyId>                            # 含拆解出的任务
xcart story create --activity <id> --title <t> [--priority high|medium|low] [--estimation <h>] [--ac "c1;c2"] [--tags a,b]
xcart story update <id> [--title] [--priority] [--estimation] [--status] [--user-task <uid>|none] [--milestone <mid>|none] [--ac "a;b"]
xcart story status <storyId> <status> [--reason]      # backlog|todo|in_progress|done|cancelled
xcart story delete <storyId>
xcart story update <id> --user-task <userTaskId>            # 挂到活动下的操作步骤（故事地图第二层）；`--user-task none` 移出步骤
xcart story update <id> --activity <activityId>            # 跨活动移动故事（order 自动追加到目标活动末尾）
xcart story move <id> <activityId>                         # 同上，命令别名

xcart story bulk-create --activity <activityId> --file stories.json
```

## 技术宪法纪律（先读后写）

实现/拆解前先执行 `xcart adr current --product <productId>`（或看 `xcart overview` 的 constitution 计数）确认架构约束；`[MUST]` 级原则直接约束本次实现方式。宪法未建立时（空数组）可建议负责人用 `xcart adr create` 沉淀首条决策。详见 skill `xcart-technical-constitution`。

## 前置条件

- X-Cartographer gateway 需在运行（默认 `http://localhost:8787`）。
- 认证：若 gateway 已启用 API Token，通过 `--token <token>` 或环境变量 `XCART_API_TOKEN` 提供；未配置 token 时免认证（本地开发）。
- 服务地址：`--server <url>` 或环境变量 `XCART_API_URL` 覆盖默认值。
- 输出：加 `--format json` 获得可解析 JSON（脚本/agent 解析推荐）；默认 table。

## 典型工作流

**正向推演（推荐顺序，三层齐全）**：

1. **需求 → 活动**：先建/选一个 activity（`activity create --product ... --name ...`）。活动是故事地图的骨干列（Patton backbone），按用户达成目标的叙事先后排列（`--order`）。
2. **活动 → 用户任务**：为该活动声明其**操作步骤**（`user-task create --activity <id> --name <n>`）。这是故事地图第二层脊线——比故事粗一档的动词短语（如活动"组织故事地图"下的步骤"调整顺序"、"筛选检索"）。**先声明步骤，再往下放故事**；某活动若归纳不出有意义的步骤，应补/调整活动，而非硬造步骤。
3. **用户任务 → 故事**：按"作为[角色]，我想要[功能]，以便[价值]"写 title；`story create` 支持 `--ac`（验收标准，`;` 分隔）与 `--priority`。故事挂在活动下，可用 `xcart story update <id> --user-task <userTaskId>` 归入某个步骤（`--user-task none` 移出步骤；未归类允许存在，但不应长期全空）。
4. **批量拆分**：把多条故事写成 `stories.json`（数组，每项含 `title/description/priority/estimation/acceptance_criteria/tags`），`story bulk-create --activity <id> --file stories.json`。
5. **排期**：`story update <storyId> --milestone <milestoneId>` 挂到版本；`--milestone none` 移出排期。
6. **跨活动移动**：`story update <storyId> --activity <activityId>`（或 `story move <storyId> <activityId>`）把故事移到目标活动，原活动保留、目标活动末尾接排。


> **注意 UserTask 与 DevTask 是不同空间的实体**：用户任务（UserTask）属**约束空间·意图**（用户要完成什么，人/Agent 通过 Agent 声明），研发任务（DevTask）属**工作空间**（我们要做什么，Agent 执行）。永远不共用词汇。域划分权威定义见 `docs/design/domain-model.md`。

## 排期评估（AI-Native 研发工时）

- `estimation` 单位 = **AI-Native 研发工时（小时）**：按 coding agent 执行评估，**不是**人工人天/人月排期。
- 拆解粒度：单任务 2-4h；整条故事先按任务累加，再反推故事级 estimation。
- 参照基准（来源于实际 agent 执行经验）：
  - 简单任务 2-3h → 10-15 分钟
  - 中等任务 5-8h → 20-30 分钟
  - 复杂任务 13h+ → 40-60 分钟
  - 完整模块 → 1-2 小时
- 排期容量同理：一个 coding agent 一天可承载的 AI-Native 工时显著高于人工排期，勿按人工日估算。
- 评估时把拆解出的任务 `estimation` 求和汇入故事，作为排期依据。

## 校验值

- `priority`: `high | medium | low`
- `story status`: `backlog | todo | in_progress | done | cancelled`
- `--ac` 用 `;` 分隔多条验收标准；`--tags`/`--tech-stack`/`--deps` 用 `,` 或 `;` 分隔。


## Agent 效率提示（数据统计与解析）

- 统计用 `overview --format json`（一次 API 完成，**不要**逐 story 拉 task list 凑数——树内含完整任务明细）
- 解析 CLI 输出优先用 **jq**（1 行指令、失败面窄），不要写 python/node 内联脚本：
  ```bash
  xcart project list --format json | jq -r '.[] | "\(.id) \(.name)"'
  ```
- 复杂多步转换才用脚本，且写成文件而非内联 heredoc
- 评测依据与数据：`tools/bench-parse.ts`（可重跑）+ 结论见 `docs/cli-agent-usage.md`
