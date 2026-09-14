---
name: xcart-technical-constitution
description: 查询与维护 X-Cartographer 的技术宪法（ADR 账本）：查看当前生效的架构原则/技术栈/模块目录、按里程碑回溯历史架构状态、创建新 ADR 记录架构决策、推进 ADR 状态流转。当 agent 需要在写代码前了解架构约束、或需要沉淀新的架构决策时使用。
---

# X-Cartographer 技术宪法（ADR）

技术宪法 = 以 ADR（架构决策记录）账本折叠出的**当前生效架构约束集**：架构原则（RFC 2119 强制力：MUST/SHOULD/MAY/MUST_NOT）、技术栈选型、系统模块目录。

**Agent 纪律：写代码前先读宪法**——`xcart overview` 的 constitution 计数或 `xcart adr current` 的原则列表里，任何 `[MUST]` 级原则都直接约束本次改动的实现方式。

## 命令

```bash
# 查看（Agent 最高频）
xcart adr current --product <productId>              # 当前生效宪法（折叠后）：原则/技术栈/模块
xcart adr list --product <productId>                 # 全部 ADR 记录（账本序）
xcart adr show <adrId>                               # 单条 ADR 详情（含 changes 差异）
xcart adr as-of-milestone <milestoneId>              # 历史架构快照（该版本交付时刻的宪法）

# 维护（仅追加，除 status 外不可变）
xcart adr create --product <productId> --title <t> --context <c> --decision <d> \
  [--status proposed|accepted] [--supersedes <oldAdrId>] \
  [--file changes.json]                              # changes: {tech_stack:{upsert,remove}, architecture_principles:{...}, modules:{...}}
xcart adr status <adrId> <status> [--reason <r>]     # proposed→accepted→(superseded|deprecated)
```

## changes 结构（§3.2���

记录**差异**，不记全量快照。同一 ADR 内 upsert/remove 的 id 不得相交（服务端 400 拒绝）。

```json
{
  "tech_stack": {
    "upsert": [{ "id": "pglite", "layer": "backend", "choice": "PGlite", "rationale": "嵌入式 SQL" }],
    "remove": ["旧选型id"]
  },
  "architecture_principles": {
    "upsert": [{ "id": "deep-tree-fetch", "strength": "MUST", "statement": "当需要深树数据时，系统应当一次性取全量而非逐节点请求" }]
  },
  "modules": { "upsert": [{ "id": "apps-server", "name": "server", "path": "apps/server", "responsibility": "Hono 网关", "depends_on": [] }] }
}
```

## 前置条件与容错

- gateway 运行中（默认 `http://localhost:8787`）；`--server`/`XCART_API_URL` 可覆盖。
- 项目尚无 ADR 时 `adr current` 返回空宪法（三空数组）——这不是错误，是「宪法未建立」的信号，agent 可建议负责人创建第一条。
- MUST 原则冲突时：**不要静默违反**。向用户展示冲突的原则（`xcart adr show`），由人裁定是改实现还是修宪法（宪法修订 = 新 ADR + supersedes 旧条）。

## 与其他 skill 的协作

- `xcart-project-overview`：overview 输出已含宪法计数摘要（principles_count/must_principles_count）。
- `xcart-task-management`：实现任务前先 `adr current` 确认约束；完成架构级改动后用 `adr create` 沉淀决策。
