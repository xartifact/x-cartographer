---
name: xcart-story-breakdown
description: 在 X-Cartographer 中维护用户故事地图：创建/查看/更新用户活动与用户故事、按 Patton 语义拆分需求为故事（骨架行优先）、批量导入、关联发布排期。当 agent 需要把需求转化为结构化用户故事地图时使用。
---

# X-Cartographer 故事拆解（用户故事地图）

本 skill 教你用 xcart CLI 操作**用户活动（activity）与用户故事（story）**，按 Patton《User Story Mapping》语义把自然语言需求落成故事地图。

> 术语与概念权威定义见 docs/design/story-map-redesign.md。

## 地图纪律（先懂地图，再放卡片）

- **横轴 = 叙事流**：用户活动从左到右按"用户达成目标的先后"排列（`order` = 端到端叙事序）。左→右是时间序/叙事序，不是优先级序。
- **纵向 = 深度序**：同一活动列内，story 的 `order` 从上到下 = 骨架行（walking skeleton，最先打通）→ 深化行（向下加深）。同深度内的权重用 `priority` 表达，不挪 `order`。
- **切片线 = 发布**：一条横线切出一组列内靠上的 story = 一个 release 切片（`milestone_id` 分组）。第一个切片（MVP）应当等同行走骨架——先打通端到端最小集，再纵向深化。
- **Activity 命名纪律**：动词短语、高层级用户行为（如"管理产品""组织故事地图"），不写功能域名词。
- **Story 标准句式**："作为[角色]，我想要[功能]，以便[价值]"。
- 活动下更细的用户操作步骤记为用户任务（user task，问题空间），与研发任务（dev task，解空间）是不同世界的实体，永远不共用词汇。

## 命令

```bash
# 用户活动（backbone）
xcart activity list --product <productId>
xcart activity info <activityId>                          # 该活动列下的故事（含 user task 分组）
xcart activity create --product <id> --name <n> [--description]
xcart activity update <activityId> [--name] [--description] [--order]
xcart activity delete <activityId>

# 用户故事
xcart story list --activity <activityId>
xcart story info <storyId>                                # 含拆解出的研发任务
xcart story create --activity <id> --title <t> [--priority high|medium|low] [--estimation <h>] [--ac "c1;c2"] [--tags a,b] [--user-task <userTaskId>]
xcart story update <storyId> [--title] [--priority] [--estimation] [--status] [--milestone <mid>|none] [--ac "a;b"] [--user-task <userTaskId>|none]
xcart story status <storyId> <status> [--reason]          # backlog|todo|in_progress|done|cancelled
xcart story delete <storyId>
xcart story update <storyId> --activity <activityId>      # 跨活动移动故事（order 追加到目标活动列末尾）
xcart story move <storyId> <activityId>                   # 同上，命令别名

xcart story bulk-create --activity <activityId> --file stories.json
```

## 前置条件

- X-Cartographer gateway 需在运行（默认 `http://localhost:8787`）。
- 认证：若 gateway 已启用 API Token，通过 `--token <token>` 或环境变量 `XCART_API_TOKEN` 提供；未配置 token 时免认证（本地开发）。
- 服务地址：`--server <url>` 或环境变量 `XCART_API_URL` 覆盖默认值。
- 输出：加 `--format json` 获得可解析 JSON（脚本/agent 解析推荐）；默认 table。

## 典型工作流（Patton 语义）

1. **需求 → 用户活动**：先建/选 activity（`activity create --product ... --name <动词短语>`）；已有的活动按叙事序复用，不要为每个需求新开一列。
2. **活动 → 用户故事（骨架行优先）**：先为每列写出 1-2 个"能端到端支撑该活动成立"的最小 story（行走骨架），`story create --activity <id> --title <标准句式>`；骨架行放同列 `order` 最前（创建顺序即深度序，先建骨架再建深化）。
3. **纵向深化**：沿列向下补充深化 story；属于某个具体操作步骤的，挂对应 user task（`--user-task <id>`）；同深度内用 `--priority` 分权重。
4. **批量拆分**：把多条故事写成 `stories.json`（数组，每项含 `title/description/priority/estimation/acceptance_criteria/tags`，可含 `user_task_id`），`story bulk-create --activity <id> --file stories.json`；按"骨架行在前、深化行在后"排数组顺序。
5. **排期（画切片线）**：`story update <storyId> --milestone <milestoneId>` 把 story 归入发布切片；切片内容优先取每列骨架行，再按深度序向下取。`--milestone none` 移出切片。
6. **跨活动移动**：`story update <storyId> --activity <activityId>`（或 `story move <storyId> <activityId>`）把故事移到目标活动列，目标列末尾接排；`--activity none` 移出活动（一般不用于移动）。

## 排期评估（AI-Native 研发工时）

- `estimation` 单位 = **AI-Native 研发工时（小时）**：按 coding agent 执行评估，**不是**人工人天/人月排期。
- 拆解粒度：单研发任务 2-4h；整条故事先按任务累加，再反推故事级 estimation。
- 参照基准（来源于实际 agent 执行经验）：
  - 简单任务 2-3h → 10-15 分钟
  - 中等任务 5-8h → 20-30 分钟
  - 复杂任务 13h+ → 40-60 分钟
  - 完整模块 → 1-2 小时
- 排期容量同理：一个 coding agent 一天可承载的 AI-Native 工时显著高于人工排期，勿按人工日估算。
- 评估时把拆解出的研发任务 `estimation` 求和汇入故事，作为切片排期依据。

## 校验值

- `priority`: `high | medium | low`
- `story status`: `backlog | todo | in_progress | done | cancelled`
- `--ac` 用 `;` 分隔多条验收标准；`--tags`/`--tech-stack`/`--deps` 用 `,` 或 `;` 分隔。

## Agent 效率提示（数据统计与解析）

- 统计用 `overview --format json`（一次 API 完成，**不要**逐 story 拉 dev-task list 凑数——树内含完整研发任务明细）
- 解析 CLI 输出优先用 **jq**���1 行指令、失败面窄），不要写 python/node 内联脚本：
  ```bash
  xcart activity list --product <id> --format json | jq -r '.[] | "\(.id) \(.name)"'
  ```
- 复杂多步转换才用脚本，且写成文件而非内联 heredoc
- 评测依据与数据：`tools/bench-parse.ts`（可重跑）+ 结论见 `docs/cli-agent-usage.md`
