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
xcart adr current --product <productId>              # 当前态：折叠后的生效宪法（原则/技术栈/模块）
xcart adr list --product <productId>                 # 演进历史：全部 ADR 记录（账本序，仅追加）
xcart adr show <adrId>                               # 演进历史：单条 ADR 详情（含 changes 差异）
xcart adr as-of-milestone <milestoneId>              # 历史态：某里程碑时刻的宪法（折叠 acceptedAt <= 该版本）

# 模块目录（宪法 modules 的一等实体；ADR 不再定义模块，§6.4）
xcart module list --project <productId>
xcart module create --project <productId> --id <slug> --name <n> [--path <p>] [--responsibility <r>] [--depends-on a,b]
xcart module update <slug> --project <productId> [--name] [--path] [--responsibility] [--depends-on a,b]
xcart module delete <slug> --project <productId>

# 维护（仅追加，除 status 外不可变）
xcart adr create --product <productId> --title <t> --context <c> --decision <d> \
  [--status proposed|accepted] [--supersedes <oldAdrId>] [--milestone <id>] [--modules a,b] \
  [--file changes.json]                              # changes: {tech_stack:{upsert,remove}, architecture_principles:{...}}
xcart adr status <adrId> <status> --reason <r>       # proposed→accepted→(superseded|deprecated)
                                                     # 升格 accepted 必带 --reason（服务端 400 + CLI 前置校验）

# 约束写入的人事追认（§6.7 方案 B；理由必填）
xcart status ratify <story|system_module|user_activity|product|user_task|milestone> <id> --reason "…"

# 主张来源（§3）：所有约束实体的 create 都接受，决定写入落点
#   --provenance human_asserted | agent_inferred | imported（缺省 agent_inferred）
```

**`--provenance` 是约束写入协议的第一等参数，不是可选装饰**（`docs/design/domain-model.md` §3/§4.1）：
它标记「这条主张是谁提出的」，与影响级别共同决定落点——`human_asserted` 直接生效；
`agent_inferred`/`imported` 遇高影响写入落 `proposed`（ADR 由服务端强制，其余实体按 §6.7
方案 B 直接生效但写 `constraint_written` 账本，待人事后 `status ratify` 追认）。
**默认值是 `agent_inferred`**（失败安全：把人的主张误标为推断只多一次确认；把推断误标为
人的主张则污染可信度且不可逆）。故 Agent 代述用户明确要求时必须显式带
`--provenance human_asserted`，否则那条需求会被记成「Agent 自己推断的」。

`--depends-on` 写入会被校验（domain-model §2.4「约束 → 约束：允许，但不得成环」+ §5「无悬空」）：
依赖必须指向**本产品目录内**的真实模块，且不得成环或自依赖，否则 400
（`unknown_module_dependency` / `module_dependency_cycle` / `self_dependency`）。

**「当前态」vs「演进历史」——最容易搞混的一对**：

| 想知道什么 | 用哪个命令 |
|---|---|
| 现在生效的约束是什么（写代码前该遵守什么） | `adr current` —— 折叠全部 accepted 记录的 changes |
| 这个约束是谁、什么时候、为什么定下的 | `adr list` / `adr show <id>` —— 账本序的决策流水 |
| 某个版本交付时生效的是什么 | `adr as-of-milestone <id>` —— 只折叠该里程碑创建时刻之前 accepted 的 |

`adr status` 改成 `deprecated` 只是「不再是权威说法」，**不会撤销它引入的状态**——撤销必须用新 ADR 的显式 `remove`（§3.1）。

## 范围边界（务必不要越界）

技术宪法只管**系统架构设计、功能与模块划分**（`tech_stack` / `architecture_principles` / `modules`），**不管编码风格与代码质量门禁**：

| 在范围内 | 不在范围内（由 Agent 自身或其 Skills 负责） |
|---|---|
| 技术栈选型、架构原则/系统边界、模块清单 | 编码风格/命名规范（本仓库 `AGENTS.md`、oxlint 已在做） |
| 模块依赖与职责划分 | 代码质量门禁（tsc/lint/build/test 是否通过）—— 属 Agent 自己运行、自己对照的执行结果 |
| 架构决策的来龙去脉（ADR） | 任务完成的审批/自证/拦截机制 —— 已明确排除，`architecture_principles` 是**纯信息注入**，不拦截任何状态流转 |

**不要把 lint/test/style 规则写进 `architecture_principles`**——那会造出一份与既有工具重复的第二真相。

## 前置条件与容错

- gateway 运行中（默认 `http://localhost:8787`）；`--server`/`XCART_API_URL` 可覆盖。
- 项目尚无 ADR 时 `adr current` 返回空宪法（三空数组）——这不是错误，是「宪法未建立」的信号，agent 可建议负责人创建第一条。
- MUST 原则冲突时：**不要静默违反**。向用户展示冲突的原则（`xcart adr show`），由人裁定是改实现还是修宪法（宪法修订 = 新 ADR + supersedes 旧条）。
- 非人主张（`agent_inferred`/`imported`）建 ADR 且未指定 status 时，服务端**强制落 `proposed`**；升格 `accepted` 必须显式执行并带 `--reason`（状态机即权限模型，§4.4）。

## 典型工作流

1. **写代码前了解约束**：`xcart adr current --product <id>`（或 `xcart ctx <taskId>` 看按模块过滤后的相关原则）；`[MUST]` 级直接约束实现方式。
2. **沉淀一个架构决策**：把 changes 写成 JSON 文件 → `xcart adr create ... --file changes.json`。
3. **确认决策生效**：`xcart adr status <adrId> accepted --reason "<依据>"` → 再 `adr current` 复核折叠结果。
4. **回看决策来龙去脉**：`xcart adr list`（全量）→ `xcart adr show <adrId>`（单条差异）。
5. **维护模块目录**：模块定义只在 `system_modules` 表，用 `xcart module` 增删改（不走 ADR 的 changes）。
6. **追认高影响写入**：Agent 代写故事/活动/模块等高影响约束后，账本会留 `constraint_written`；由人复核并 `xcart status ratify <type> <id> --reason "<依据>"` 追认（重复追认 409）。

## changes 结构（§3.2）

`--file changes.json` 记录**差异**，不记全量快照。同一 ADR 内 upsert/remove 的 id 不得相交（服务端 400 拒绝）。
`modules` 一类**已废弃**——模块定义只在 `system_modules` 表（§6.4），用 `xcart module` 维护，不要写进 changes。

```json
{
  "tech_stack": {
    "upsert": [{ "id": "pglite", "layer": "backend", "choice": "PGlite", "rationale": "嵌入式 SQL" }],
    "remove": ["旧选型id"]
  },
  "architecture_principles": {
    "upsert": [{
      "id": "deep-tree-fetch",
      "strength": "MUST",
      "statement": "当需要深树数据时，系统应当一次性取全量而非逐节点请求",
      "module_ids": ["api-routes"]
    }]
  }
}
```

`module_ids` 留空 = 项目全局生效（所有 story/task 的 `architecture_context` 都会包含它）；填写则只在模块范围相交时出现（§4 过滤规则）。

## 校验值

- `strength`（原则强制力）: `MUST | SHOULD | MAY | MUST_NOT`（RFC 2119 四值）
- ADR `status`: `proposed | accepted | rejected | deprecated | superseded`
- `Module.id`: 小写 slug（`^[a-z0-9][a-z0-9-]*$`，如 `gateway`/`web-spa`）——会被 `principles.module_ids` 与 story/task 的 `affected_modules` 反复引用，故不用随机 id

## Agent 效率提示

- **一次取全**：`adr current` 返回完整宪法；不要逐条 `adr show` 拼装当前态（会漏掉被 supersede 的折叠语义）。
- story/task 的相关原则已在 `xcart story info` / `xcart task info` 的 `architecture_context` 字段里按模块过滤好（`relevant_principles`/`relevant_modules`），无需自己重新过滤。
- 解析用 jq：`xcart adr current --product <id> --format json | jq -r '.architecture_principles[] | "[\(.strength)] \(.statement)"'`


## 与其他 skill 的协作

- `xcart-project-overview`：overview 输出已含宪法计数摘要（principles_count/must_principles_count）。
- `xcart-task-management`：实现任务前先 `adr current` 确认约束；完成架构级改动后用 `adr create` 沉淀决策。
