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
xcart story create --activity <id> --title <t> [--priority high|medium|low] [--estimation <h>] [--ac "c1;c2"] [--tags a,b] [--affected-modules m1,m2] [--user-task <uid>] [--milestone <mid>]
xcart story update <id> [--title] [--priority] [--estimation] [--status] [--user-task <uid>|none] [--milestone <mid>|none] [--ac "a;b"] [--affected-modules m1,m2]
xcart story status <storyId> <status> [--reason]      # backlog|todo|in_progress|accepted|cancelled（注意：故事无 done，验收通过是 accepted）
xcart story delete <storyId>
xcart story update <id> --user-task <userTaskId>            # 挂到活动下的操作步骤（故事地图第二层）；`--user-task none` 移出步骤
xcart story update <id> --activity <activityId>            # 跨活动移动故事（order 自动追加到目标活动末尾）
xcart story move <id> <activityId>                         # 同上，命令别名

xcart story bulk-create --activity <activityId> --file stories.json
```

## 技术宪法纪律（先读后写）

实现/拆解前先执行 `xcart adr current --product <productId>`（或看 `xcart overview` 的 constitution 计数）确认架构约束；`[MUST]` 级原则直接约束本次实现方式。宪法未建立时（空数组）可建议负责人用 `xcart adr create` 沉淀首条决策。详见 skill `xcart-technical-constitution`。

**拆解时标注影响模块（`--affected-modules`）**：把故事涉及的系统模块 slug 写进去（模块目录用 `xcart module list --project <id>` 查）。这不是行政手续——`xcart story info` 与 `xcart task info` 的 `architecture_context` 字段正是拿它做范围过滤，**没有标注就拿不到那个模块的架构原则**（`relevant_principles` 为空）。故事拆解阶段就该标，任务拆解时可继承故事的标注。

**引用会被校验，跨域写入直接 400**（`docs/design/domain-model.md` §5「无悬空」+ 实体均有产品作用域）：

- **版本必须与故事同产品**：`--milestone` 只接受本产品的版本，否则 `cross_product_milestone`。
  排期与可预测性按版本聚合，跨产品挂载会让该版本的分母混入他产品故事。
- **步骤必须与故事同活动**：`--user-task` 只接受本活动下的步骤，否则 `cross_activity_user_task`。
  地图按活动分列、再按步骤分组渲染，跨活动挂载会让故事在自己的步骤区不可见。
- **引用的实体必须存在**：引用不存在的版本/步骤/活动/产品 → `foreign_key_violation`（400）。
  同时**故事必须归属一个活动**（`activity_id` 必填）：解挂会让它及其研发任务从所有视图消失。

## 拆解前检查与验收交接（MUST）

在创建或重构活动、用户任务、故事之前，Agent MUST 先执行 `xcart project info --id <productId>`（或 `xcart context export <productId>`）了解现有需求和版本布局，再执行 `xcart adr current --product <productId>` 与 `xcart module list --project <productId>` 确认架构约束和可用模块 slug。不得绕过产品/架构上下文，直接把自然语言需求降为研发任务。

每条故事的 `--ac` 必须是可观察、可验证的用户结果，而非“实现 X”“代码通过”这类实施动作。拆解 DevTask 时，应让每项任务对应一条或多条 AC，或明确它是为这些 AC 提供支撑的工程工作；并用 `--affected-modules` 将故事的架构影响面交给任务 preflight。

DevTask `done` 只表示该研发工作已按实际验证完成，不等于故事已经验收。执行者应在完成相关任务后以 `xcart story info <storyId>` 对照全部 `acceptance_criteria`；仅当所有条目已满足时，才执行 `xcart story status <storyId> accepted --reason "<验收依据>"`。未覆盖的 AC 必须保留故事在非 `accepted` 状态并继续拆解/执行，不得用任务状态替代故事验收。


## 前置条件

- X-Cartographer gateway 需在运行（默认 `http://localhost:8787`）。
- 认证：若 gateway 已启用 API Token，通过 `--token <token>` 或环境变量 `XCART_API_TOKEN` 提供；未配置 token 时免认证（本地开发）。
- 服务地址：优先写 `~/.config/xcart/config.toml` 的 `server = "<url>"`；`--server <url>` 可单次覆盖，其后才是环境变量 `XCART_API_URL` 与默认值。旧 `~/.config/xcart/config` 的 key=value 文件在首次运行时自动迁移为 TOML，旧文件保留。
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

## 写作纪律（命名与目标）

故事地图的语义靠**词汇纪律**承载——命名一旦退化，地图就变回待办列表。三条硬规则：

### 1. 活动 / 用户任务 = backbone 动词短语

骨干层（活动、用户任务）是**用户动作**，不是系统模块、不是名词短语。

| ✅ 正例 | ❌ 反例 | 问题 |
|---|---|---|
| 组织故事地图 / 拆解任务 / 规划发布 | 故事地图管理 / 任务系统 / 版本模块 | 名词短语——那是模块目录的词汇，不是用户动作 |
| 调整顺序 / 筛选检索 / 发布切片 | 排序功能 / 搜索 / 切片 | 名词化，丢掉了"谁在做什么" |
| 安装设备 / 配置设备 / 日常使用 | 设备管理 / 配置项 / 使用 | 抽象层级错乱，无法判断故事该落在哪一列 |

判据：**骨干层的词应当能填进"用户在 ______"**。填不进去就不是骨干。

### 2. `order` = 用户流程顺序，不是创建顺序

`--order` 决定列的左右位置，语义是**用户叙事先后**（先安装才能配置，先配置才能使用）。
不是"谁先建的就排前面"。新列插入时按流程位置给 order，而不是追加到末尾。

### 3. `milestone.goal` 必须 SMART

版本目标是**可判定是否达成**的承诺，不是愿望清单。

| ✅ 正例 | ❌ 反例 | 问题 |
|---|---|---|
| 各旅程核心能力落地：故事地图、任务管理、排期、CLI/API 集成 | 把产品做得更好用 | 无法判定达成 |
| 第三方可开发插件：共享打包预设、开发文档、运行时装卸载与 HMR | 完善插件生态 | 无边界（"完善"没有终点） |
| i18n 时区/国际化、架构修复、日志存储优化 | 提升系统质量 | 不可验收 |

判据：**看到 goal 能否写出退出信号**（"满足什么条件算完成"）。写不出就重写 goal。

> 这三个纪律的失败模式相同：**用名词描述动作、用顺序描述优先级、用愿望描述目标**——
> 结果是地图看起来完整，但没有任何一列能回答"为什么它在这里"。

## 校验值

- `priority`: `high | medium | low`
- `story status`: `backlog | todo | in_progress | accepted | cancelled`（**无 `done`**——故事是意图，验收通过记 `accepted`；研发任务的 `done` 是另一套状态机，两者词不同义不同）
- `--ac` 用 `;` 分隔多条验收标准；`--tags`/`--tech-stack`/`--deps` 用 `,` 或 `;` 分隔。


## Agent 效率提示（数据统计与解析）

- 统计用 `overview --format json`（一次 API 完成，**不要**逐 story 拉 task list 凑数——树内含完整任务明细）
- 解析 CLI 输出优先用 **jq**（1 行指令、失败面窄），不要写 python/node 内联脚本：
  ```bash
  xcart project list --format json | jq -r '.[] | "\(.id) \(.name)"'
  ```
- 复杂多步转换才用脚本，且写成文件而非内联 heredoc
- 评测依据与数据：`tools/bench-parse.ts`（可重跑）+ 结论见 `docs/cli-agent-usage.md`
