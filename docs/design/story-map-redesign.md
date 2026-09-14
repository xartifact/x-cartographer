# X-Cartographer 需求管理重设计：用户故事地图语义

> 状态：**设计定稿，待实施（2026-09-10）**。本文档是概念体系的唯一权威定义，替代既有文档中"用户旅程（journey）/任务（task）"的旧语义。
> 遵循 `docs/design/ai-native-product-principles.md`；方法论依据：Jeff Patton《User Story Mapping》+ TasksBoard《用户故事映射指南》。

## 1. 设计动机

旧模型中 `UserJourney`（用户旅程）实体混淆了两个方法论的词汇：用户旅程图（Journey Map，用户视角的体验叙事）与用户故事地图（Story Map，产品视角的需求组织）。实际数据证明其语义是"产品功能域"（如"技术宪法与架构治理"），既不是用户的旅程，也不支撑地图叙事。同时 `Task` 实体与用户域的"用户任务"概念撞名。

本次重设计：**两图分离，概念各归其位，命名空间按域划分。**

## 2. 命名空间规范

| 域 | 前缀 | 含义 |
|---|---|---|
| 用户域 | `User` / `user_` | 问题空间：用户要什么（用户故事地图的内容） |
| 执行域 | `Dev` / `dev_` | 解空间：我们要做什么（交付拆解） |
| 平台域 | 无前缀 | 基础设施实体 |

## 3. 实体模型

### 3.1 平台域

| 实体 | 中文 | 表 | 说明 |
|---|---|---|---|
| `Product` | 产品 | `products` | 原 Project 正名。产品是持续演进的需求载体（非时间性"项目"） |
| `Milestone` | 发布 | `milestones` | Release 切片线。goal 必须写 SMART 业务目标（Outcome），非功能清单 |
| `StatusChange` | 状态账本 | `status_changes` | 审计账本，全实体状态流转记录 |
| `AdrRecord` | 架构决策 | `adr_records` | 技术宪法（见 technical-constitution.md） |

### 3.2 用户域（用户故事地图）

**地图结构**：

```
横轴 = 用户旅程（叙事流，从左到右 = 用户达成目标的先后）
┌────────────┬────────────┬────────────┐
│ UserActivity│ UserActivity│ UserActivity │   ← Backbone（骨干）
│ "管理产品"   │ "组织故事地图"│ "跟踪执行"    │
├────────────┼────────────┼────────────┤
│ UserTask    │ UserTask    │              │   ← 活动下的用户任务
│ "创建产品"   │ "创建故事"   │              │
│  ├ UserStory│  ├ UserStory│              │   ← 切片（纵向卡片）
│  │ (骨架行)  │  │ (骨架行)  │              │
│  └ UserStory│             │              │
│    (深化行)  │             │              │
╞════════════ Release: v0.1 ═══════════════╡   ← Milestone 切片线
│ UserStory (深化行，v0.2)                    │
└────────────┴────────────┴────────────┘
```

| 实体 | 中文 | 表 | 定义 |
|---|---|---|---|
| `UserActivity` | 用户活动 | `user_activities` | Backbone 节点。高层级用户行为（动词短语，如"组织故事地图"）。`order` = 端到端叙事序 |
| `UserTask` | 用户任务 | `user_tasks` | 活动下的具体操作步骤（如"拖拽调整故事位置"）。挂 activity，弱实体（地图元素，非需求容器） |
| `UserStory` | 用户故事 | `user_stories` | 纵向切片。字段变更：`journey_id → activity_id`（必填，地图列归属）、新增 `user_task_id?`（可空，深化时挂具体步骤）。`order` 语义重定义 = **同列内深度序：骨架行在上，深化行向下** |

**方法论核心概念 → 实现映射**：

| 概念 | 实现 |
|---|---|
| 骨干（Backbone） | `user_activities` 按 `order` 的横向序列 |
| 行走骨架（Walking Skeleton） | 每列深度序最前的 story 集合（能端到端打通的最少切片） |
| MVP | 第一个 release 切片（骨架行优先入选）——等同行走骨架 |
| 发布切片（Release Slices） | `milestone_id` 分组 + 地图渲染横线 |
| 深度与优先级 | 同列内 `order`（骨架→深化）+ `priority`（同深度内权重） |
| 用户旅程（横轴） | activities 的 order 排列（按用户达成目标的时间序） |

**注意**：UserTask 与 DevTask 是不同世界的实体——前者是问题空间（用户要完成什么），后者是解空间（我们做什么）。永远不共用词汇。

### 3.3 执行域

| 实体 | 中文 | 表 | 说明 |
|---|---|---|---|
| `DevTask` | 研发任务 | `dev_tasks` | 原 `Task` 正名。AI/人执行的研发工作（挂 story、依赖 DAG、CAS 认领）。**`type` 字段废除**（原 user_story/technical_task/bug_fix/spike 分类随实体切割失效），交付性质由 tags 承载（既有惯例：`architecture-enabler` 等标签已在使用） |

### 3.4 明确不做

- **Epic / Feature 实体**：SAFe 缓议，单产品场景现有分层够用；将来多产品组合再评估
- **User Journey Map 实体**：旅程图（情绪/触点/痛点）是独立方法论工具，与故事地图正交；persona 以字段形式保留在 Product 上（产品服务谁）
- **跨列切片（story 多 activity）**：Patton 简化语义（单归属），现有 story 粒度均为单活动归属，多对多无真实场景

## 4. 数据迁移（历史数据保全）

**迁移原则：全量、可断言、可回滚。**

### 4.1 迁移范围基线（生产库快照，2026-09-10；量级为本产品口径）

| 数据 | 量级 | 迁移动作 |
|---|---|---|
| products（原 projects） | 全部（现有 1 个主产品） | 表 rename，数据原样 |
| user_journeys | 10 | 语义分流（见 4.2），退役 |
| user_stories | 57 | **全部保留**，重挂 activity（±user_task）；order 重排 |
| tasks → dev_tasks | 199 | **全部保留**，type 字段值转 tags 后删除列 |
| status_changes | 650+ | **不动**（entity_id 引用不因 rename 失效——task id 不变） |
| milestones | 2 | 不动 |
| adr_records | 0+ | 不动 |

> 注：迁移脚本的前置断言以**执行时刻实时计数**为准（本表数字为 2026-09-10 快照，供量级参照；断言逻辑 = 迁移前后 stories/tasks/changes 总数一致，而非硬编码本表数字）。

### 4.2 journey 分流规则

| 现 journey | 判定 | 去向 |
|---|---|---|
| 记录已废弃的内置 LLM 需求 | 归档桶 | stories 原样保留（cancelled 不渲染），activity 归入"治理架构"深化行 |
| 搭建研发基础设施 | 技术故事容器 | story → "跟踪执行" 活动深化行，tags 带 `architecture-enabler` |
| 技术宪法与架构治理 / 关系可视化 / 故事地图规划 / 任务拆解与规划 / 研发任务管理 / 系统配置与帮助 / 排期规划 / AI 集成 | 功能域（内容为用户视角 story） | story 按 4.3 归位表重挂到 5 个新 activity |

### 4.3 新 Activity 骨架（5 列）与 story 归位

| # | UserActivity | 承接现 story 域 |
|---|---|---|
| 1 | 管理产品 | 项目 CRUD/切换/导入导出/持久化（原研发任务管理部分 + 系统配置部分） |
| 2 | 组织故事地图 | 故事地图规划 + 关系可视化 + 帮助文档 |
| 3 | 拆解任务 | 任务拆解与规划 |
| 4 | 跟踪执行 | 研发任务管理主体 + 基础设施 + 技术宪法（治理为执行的深化行） |
| 5 | 规划发布 | 排期规划 + AI 集成存活项 |

**UserTask 生成规则**：从归位 story 的操作语义归纳（一个 activity 下通常 3-8 个 user task）；story 的 `user_task_id` 首轮迁移可空（深化时再挂），骨架行判定优先。

**骨架行判定规则**（walking skeleton）：每 activity 选 1-2 个"能端到端支撑该活动成立"的最小 story 置于深度序最前；判定依据 = 现网已交付（status=done）且被其余 story 依赖的基础能力。

### 4.4 迁移执行与断言

> 一键编排：`cd apps/server && bun scripts/run-migrate-story-map.ts [--dry-run]`（步骤 0-5 全自动：前置断言→结构迁移(0003 幂等)→半迁移清理→缺列补齐→数据归位→后置断言；可重入）

> 一键编排：`cd apps/server && bun scripts/run-migrate-story-map.ts [--dry-run]`（步骤 0-5 全自动：结构迁移→半迁移清理→缺列补齐→数据归位→断言；幂等可重入）

1. **前置断言**：迁移脚本启动时记录源数据量级基准（本产品 stories / dev_tasks(原 tasks) / status_changes 实时计数），任何一项为 0 或明显异常（与 §4.1 快照量级偏差 >20% 且无说明）即中止
2. **执行顺序**：建新表 → 迁 products → 生成 activities/user_tasks → 重挂 stories（写 activity_id，保留 journey_id 列不删作为回滚依据）→ tasks→dev_tasks（type 值并入 tags）→ 校验
3. **后置断言**：story 总数不变、每 story activity_id 非空、dev_task 总数不变、status_changes 总数不变、cancelled story 全部保留
4. **回滚设计**：journey_id 列保留 + 旧表 rename 保留（`_legacy_user_journeys`），回滚 = 恢复列指向
5. **迁移期兼容**：server 旧路由 `/api/journeys/*` 返回 410 Gone（带迁移说明）；CLI `journey` 命令提示迁移；`/api/tasks` 301 → `/api/dev-tasks` 一个版本

## 5. 代码改动清单（实施顺序）

| # | 层 | 内容 |
|---|---|---|
| 1 | packages/db | 新表 `products/user_activities/user_tasks/dev_tasks`；`stories` 加 activity_id/user_task_id；type 列下线；迁移 0003 |
| 2 | packages/shared | `Product/UserActivity/UserTask/DevTask` 类型；story 字段替换；`Task/TaskType/Project/journey 类型`删除 |
| 3 | apps/server | 全路由 rename + 新实体 CRUD + 深树接口 journeys→activities（含 user_tasks 嵌套）+ 兼容 410/301 |
| 4 | apps/cli | `product/activity/user-task/dev-task` 命令组；`project/task` alias 一版 |
| 5 | apps/web | 地图重构（列=activity、user_task 分组、骨架/深度行、release 横线）；全局文案"项目"→"产品"；路由 `/projects→/products` |
| 6 | 数据迁移脚本 | 按 §4.4 执行 + 断言 |
| 7 | skills/docs | SKILL×3 术语+工作流重写；AGENTS.md 同步 |
| 8 | e2e | spec 断言更新 |

## 6. 术语对照表（旧 → 新）

| 旧 | 新 |
|---|---|
| 项目 / Project | 产品 / Product |
| 用户旅程 / Journey | （退役）语义分流：功能域→按内容归入 Activity；地图位置→UserActivity |
| 任务 / Task | 研发任务 / DevTask |
| TaskType.user_story | （废除）tags 承载 |
| 里程碑/版本 Milestone | 发布（Release 切片） |
| — | 用户活动 / UserActivity（新） |
| — | 用户任务 / UserTask（新） |
