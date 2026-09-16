# X-Cartographer — 技术宪法（Technical Constitution / ADR）设计

> 状态：**设计定稿，待实现（2026-09-05；2026-09-15 域归属已明确）**。本文档回答"技术宪法长什么样、为什么这样设计"，遵循 `docs/design/ai-native-product-principles.md` 的 P1–P5；与 `x-cartographer-architecture.md` 互补，不重复其内容。数据模型部分以本文档为准；文件级改动落点（schema/route/CLI 的具体代码位置）留待实现阶段单独产出，不在本文档中固化。
>
> **域归属（2026-09-15 补）**：`AdrRecord` 与 `SystemModule` 均属 `domain-model.md` §2 的**约束空间·规矩（Doctrine）**——即"我们决定怎么做"。它们此前被归入平台域，现与其他约束实体统一，§4 的 `resolveEffectiveArchitectureContext` 因此不再跨域。
>
> 设计取舍原则：本文档在正确性与简单性冲突时，**优先正确性**——凡是"更简单但可能悄悄丢信息/悄悄产生歧义"的做法，一律不采用，即便它能减少代码量。

## 1. 背景与动机

X-Cartographer 目前只管理"做什么"（需求→故事→任务→里程碑），完全没有"怎么做"的概念——AI Agent Loop 自主研发时，除了任务清单，还需要知道目标系统的技术栈、架构边界和模块划分。技术宪法填的是这个缺口。

## 2. 范围与边界（明确排除什么）

技术宪法只管**系统架构设计、功能与模块**，不管编码风格、代码质量：

| 在范围内 | 不在范围内，理由 |
|---|---|
| 技术栈选型（tech_stack） | 编码风格/命名规范——属于 Agent 自身或其 Skills 的操作规范（本仓库的 `AGENTS.md`/`CLAUDE.md`/oxlint 已经在做这件事，再建一份是重复建设，违反 P4） |
| 架构原则/系统边界（architecture_principles） | 代码质量门禁（tsc/lint/build/test 是否通过）——属于 Agent 自己运行、自己对照的执行结果，不需要 X-Cartographer 建模或拦截任务状态流转 |
| 模块/组件清单（modules） | 任务完成时的自证/复核机制——已明确排除，architecture_principles 是纯信息注入，无任何拦截或自证 |

## 3. 数据模型

### 3.1 `AdrRecord`——唯一持久化实体

技术宪法的演进本质是"一系列被记录下来的架构决策"，所以只建一张**仅追加**的决策记录表，不再单独维护一张"当前态"表——原因见 §3.3。

```
AdrRecord {
  id, project_id
  title: string
  status: 'proposed' | 'accepted' | 'rejected' | 'deprecated' | 'superseded'
  context: string
  decision: string
  consequences?: string
  alternatives_considered?: string
  supersedes?: string           // 指向被这条替代的旧 ADR id
  milestone_id?: string
  module_ids?: string[]         // 涉及哪些模块，信息性标注
  changes?: AdrChanges          // 见 §3.2；可选——只有这条决策真的改变当前态时才带
  created_at: Timestamp
  seq: bigserial                // DB 生成的严格单调序号，见 §3.3
}
```

**`AdrRecord` 除 `status` 外全部字段一旦创建即不可变**（`context`/`decision`/`changes` 等永远不改写）。`status` 是唯一允许变化的字段，且**不直接改写记录，而是复用本系统已有的 `status_changes` 审计账本**——跟 Task/Story 的状态流转完全同构（P4：新治理机制复用同一本账本，不发明平行机制），每次状态变化必须带理由，且可查历史轨迹。

**关键纠正：`status` 的变化永远不影响 §3.3 的折叠结果——它纯粹是文档/叙事层面的标签，不是状态账本。** 唯一能让"当前态"发生变化的动作，是某条 ADR 携带了显式的 `changes`（见 §3.2）。理由是一个具体反例：ADR-3 当初"选 Bun 是因为理由 X"，后来发现理由 X 站不住脚，但 Bun 这个选择本身依然成立，只是要换个理由——写 ADR-12，`supersedes: 'adr-3'`，`changes` 留空。如果"折叠时按当前 `status` 过滤"（旧设计），ADR-12 写入后 ADR-3 被标记 `superseded`，折叠算法就会把 ADR-3 排除，Bun 这条事实随之从当前态里**悄悄消失**——即便根本没人决定撤销它。"这份文档不再是权威说法"（superseded/deprecated 该表达的意思）和"这份文档引入的状态要撤销"是两件不同的事，硬塞进一个 `status` 字段必然两头都错。**真要撤销一条状态，必须写一条新 ADR，显式 `changes.remove` 那个 id**——可以顺带 `supersedes` 指向旧 ADR 做文档关联，但撤销动作本身永远是显式的 `changes`，不是 `status` 变化的副作用。

有效的 `status` 状态机（终态不可再转）：`proposed → accepted`、`proposed → rejected`、`accepted → deprecated`、`accepted → superseded`。一条 ADR 一生中最多经历一次"进入 `accepted`"，这个时间点记作 `acceptedAt(record)`（通过 `status_changes` 里那条 `proposed→accepted` 的转移记录取得；直接以 `accepted` 创建的记录，`acceptedAt` 就是它的创建时刻）。**`acceptedAt` 是折叠算法唯一关心的历史事实**——见 §3.3。`rejected` 的记录 `acceptedAt` 永远是空，天然不会进入任何折叠结果，不需要额外校验"`rejected` 不能带 `changes`"这类规则。

**新增 `rejected` 状态**——对应"评估过、决定不做"的决策。这不是假设性场景：本仓库的 `docs/design/pi-sdk-integration.md`、`pi-xherald-integration.md`，以及 `AGENTS.md` 里"MCP 确认不实现"这条记录，都是真实存在、评估过、拍了板、但从未产生任何"当前生效"结构化状态的决策。旧设计（ADR 挂靠在 Constitution 名下，只有"改变了当前态才算数"）没有地方安放这类决策；提升为独立实体后，这类决策就是一条 `status: rejected`、`changes` 为空的 `AdrRecord`，跟"MCP 是否可行"这个问题绑在一起，可查询、有权威落脚点，不会再重演"三份文档互相矛盾"的问题。

`supersedes` 字段的写入行为：创建一条带 `supersedes` 的新 ADR 时，服务端顺手为被指向的旧 ADR 写一条 `status_changes` 记录（状态转 `superseded`，理由自动填"由 ADR-{new_id} 替代"）——这是结构性联动，不是语义判断，符合 P3。**这条联动只影响文档标签，不影响折叠**：如果新 ADR 的意图也包括撤销旧 ADR 引入的状态，必须在同一条新 ADR 里显式写 `changes.remove`，`supersedes` 本身不会自动做到这一点。

### 3.2 `AdrChanges`——记差异，不记全量

```
AdrChanges {
  tech_stack?:              { upsert?: TechStackEntry[],      remove?: string[] }
  architecture_principles?: { upsert?: ArchitecturePrinciple[], remove?: string[] }
  modules?:                 { upsert?: SystemModule[],        remove?: string[] }
}
```

**为什么不是"变更时点的完整快照"**：如果每条 ADR 都要携带当时全部的 tech_stack/principles/modules（包括这次根本没变的），会强迫作者在每次改动时把已有的一切原样抄一遍——一旦漏抄，"当前态"就悄悄丢了一条已有原则，且**没有任何痕迹能说明这是故意移除还是抄漏了**。这是决策记录系统不该有的缺陷。改成只记差异后，`remove` 本身就是一次显式的、需要在 `context`/`decision` 里说明理由的动作，不会再有"静默丢失"的可能。

**语义细则**：
- `upsert` 是整体替换/插入（按 `id` 定位），不是字段级合并——改一条原则的 `module_ids` 也要把整个 `ArchitecturePrinciple` 对象重新提交一次。这避免了"部分更新怎么合并"这种额外的歧义，且每次改动本来就该被视为一次完整的新决定，而不是给旧对象打补丁。
- 同一条 ADR 内，**同一个 id 不能同时出现在 `upsert` 和 `remove` 里**——服务端拒绝这种请求，纯结构校验，不涉及语义判断。

### 3.3 "当前态"是折叠出来的投影，不是单独维护的表

**排序键**：`AdrRecord.seq` 是数据库生成的严格单调递增序号（bigserial），是折叠顺序的唯一权威依据——不用 `created_at` 做排序（同一毫秒内并发写入时，时间戳可能相同，产生排序歧义），也不用 `id`（本系统其余表用的 nanoid 不保证时间可排序）。`created_at` 只用于人类展示。

**当前态查询**：

```
foldConstitution(records: AdrRecord[]):  // records 已按 seq 升序排列
  techStack = Map<id, TechStackEntry>()
  principles = Map<id, ArchitecturePrinciple>()
  modules = Map<id, SystemModule>()

  for r in records:
    apply(techStack,  r.changes?.tech_stack)
    apply(principles, r.changes?.architecture_principles)
    apply(modules,    r.changes?.modules)
  return { tech_stack: values(techStack), architecture_principles: values(principles), modules: values(modules) }

apply(map, delta):
  for entry in delta?.upsert ?? []: map.set(entry.id, entry)
  for id    in delta?.remove ?? []: map.delete(id)

getCurrentConstitution(projectId):
  records = AdrRecord where project_id=projectId AND acceptedAt is not null AND changes is not null, order by seq asc
  return foldConstitution(records)
```

**折叠只看 `acceptedAt`，不看当前 `status`**——一条 ADR 一旦被 accept，它的 `changes` 永久生效，之后无论被打上 `deprecated` 还是 `superseded` 标签都不影响折叠结果（理由见 §3.1 的反例）。这也让"当前态"查询不需要联查 `status_changes` 的完整状态历史，只需要知道每条 ADR 有没有 `acceptedAt`。

**"截至某个里程碑时"的查询，要用"当时是否已经 accept 过"，不是"当时的完整 status"**——这是容易做错、也是唯一还需要联查历史的地方：如果 ADR-3 在里程碑 X 达成之后才被 accept，那么"里程碑 X 时的架构"不应包含它（当时它还只是草案）；但如果 ADR-3 在里程碑 X 之前已经 accept，之后（今天）才被打上 `deprecated`/`superseded` 标签，"里程碑 X 时的架构"依然应该包含它——**今天贴的文档标签，不能改写昨天已经生效的事实**。

```
getConstitutionAsOfMilestone(milestoneId):
  cutoffSeq = AdrRecord[milestone.adr_id].seq
  candidates = AdrRecord where project_id=... AND seq <= cutoffSeq AND changes is not null
  records = candidates filtered to: acceptedAt(record) is not null AND acceptedAt(record) <= cutoffTime
            // 只查"何时进入 accepted"这一个历史事实，不查 deprecated/superseded/rejected 的完整状态历史
  return foldConstitution(records ordered by seq asc)
```

**性能是未来的问题，不是现在要为它牺牲正确性的理由**：项目生命周期内 ADR 数量是几十到几百量级，折叠一次是廉价操作。真到需要优化时，标准做法是引入"折叠检查点"（比如每 N 条 ADR 缓存一次折叠结果），检查点的地位必须明确是**日志的确定性缓存、可随时从头折叠重新验证**，不是独立维护、可能与日志脱节的第二份真相——不能为了避免重复折叠就退回"单独维护一张当前态表、靠代码保证同步"的旧问题。

### 3.4 `TechStackEntry`——事实陈述，不是规范性陈述

```
TechStackEntry { id, layer, choice, version?, rationale? }
```

不带 RFC 2119 强制力关键词、不带 EARS 句式：技术栈描述的是"选了什么"，是事实，不是行为义务。也不需要额外的范围化字段——`layer`（frontend/backend/tooling/…）本身就是它的原生范围化维度。

**写作纪律**：`AGENTS.md` 里"Bun 运行时 + pnpm 依赖管理（勿引入 npm 新增包）"这类句子，事实和义务缝在了一起。技术宪法要求拆开写——`tech_stack.changes.upsert` 记"选了 Bun/pnpm"，`architecture_principles.changes.upsert` 记"不得用 npm 装新包"这条派生出来的强制规则，不要把 MUST 语句藏进 `rationale` 的自由文本里。

### 3.5 `ArchitecturePrinciple`——规范性陈述，RFC 2119 + EARS

```
ArchitecturePrinciple {
  id
  strength: 'MUST' | 'SHOULD' | 'MAY' | 'MUST_NOT'   // RFC 2119
  statement: string   // EARS 句式："当 <触发/条件>，<主体> 应当 <行为>"
  rationale?: string
  module_ids?: string[]   // 留空 = 项目全局生效；非空 = 只对涉及这些模块的 Story/Task 生效
}
```

示例（改写自 `AGENTS.md` 已有的真实规则）：

```
[MUST] 深树一次取全：GET /api/projects/:id 必须返回完整 user_journeys[].stories[].tasks[]；
        调用方不得逐 story 拉取 task list。
Rationale: 避免 N+1（已有前科）。
module_ids: ["gateway"]
```

**纯粹是信息，不产生任何服务端裁决**——没有自证字段、没有复核流程、不拦截任何状态流转。Agent 在 `task info`/`story info`/`context export` 里读到它，自己决定怎么落实。

### 3.6 `SystemModule`——模块/组件目录

```
SystemModule { id, name, path, responsibility, depends_on: string[] }
```

`id` 用人类可读的稳定 slug（如 `gateway`、`web-spa`、`shared-types`），不用随机 id——它会被 `architecture_principles.module_ids`、`UserStory.affected_modules`、`Task.affected_modules` 反复引用，Agent 需要能直接拼出/记住它。这是 Story/Task 与架构原则关联的锚点，取代了早期讨论过的"标签匹配"方案。

### 3.7 现有实体的扩展

```
Milestone.adr_id?: string           // 可空，纯字段，无 DB 级外键（见 §9 风险）；标记该里程碑锚定在 ADR 时间线的哪个 seq
UserStory.affected_modules?: string[]   // 引用 SystemModule.id
Task.affected_modules?: string[]        // 不填 = 继承所属 Story 的并集；填了 = 收窄
```

`UserJourney` **不扩展**——旅程层面的模块归属现算：读 `journey info` 时对下属所有 Story 的 `affected_modules` 取并集展示，不单独存储（数据源只有一处，别处都是投影，P1）。

## 4. 解析算法：Task/Story 的"有效架构上下文"

```
resolveEffectiveArchitectureContext(task):
  story = getStory(task.story_id)
  base  = story.milestone_id 有 adr_id
            ? getConstitutionAsOfMilestone(story.milestone_id)   // 历史态，见 §3.3
            : getCurrentConstitution(project_id)                  // 当前态，见 §3.3

  moduleScope = task.affected_modules ?? story.affected_modules ?? []

  relevantPrinciples = base.architecture_principles.filter(p =>
    !p.module_ids?.length || intersects(p.module_ids, moduleScope)
  )
  relevantModules = base.modules.filter(m => moduleScope.includes(m.id))
  # tech_stack 全量展示（体量小、事实性、天然项目级）
```

`story info`（拆解阶段，modules 只用 `story.affected_modules`）与 `task info`/`task next`（用 `task.affected_modules ?? story.affected_modules`）复用同一个过滤逻辑，只是输入的 scope 来源不同。

## 5. Milestone 绑定：手动，不自动触发

**不做自动快照**（创建/完成里程碑时自动关联最新 ADR）。理由：里程碑通常提前规划，真正开始做事时架构可能已经变了几轮，自动关联捕捉的是当时未必准确的状态；而且"具体哪个状态迁移触发关联"是个武断选择，属于隐式副作用，与本系统"每次变更都显式 `--reason`"的既有习惯（P4）相悖。

`xcart adr create --milestone <id> ...` 保持人类/Agent 主动关联——架构因为这个里程碑的工作发生实质变化时，顺手带上 `--milestone`。没做就没有，历史记录依然完整可用，只是少了"按里程碑精确查询"这层精度，这个降级可以接受。

## 6. Agent 消费面（必须首发即接入，不能"以后再补"）

对照 P2 的教训——`Project.metadata.tech_stack: string[]` 从未被任何输出面读取，是孤儿字段。技术宪法必须在同一次改动里接入：

- `xcart adr create/list/show <id>`——创建/查询决策记录
- `xcart adr current --project <id>`——查当前态（§3.3 的折叠查询）
- `xcart overview` / `xcart context export`——展示宪法摘要 + 当前上下文相关的 modules/principles
- `xcart story info` / `xcart task info` / `xcart task next`——按 §4 算法展示 `relevantPrinciples`/`relevantModules`
- 新 Skill：`skills/xcart-technical-constitution/SKILL.md`（面向 Agent 的"用途"不变，仍是"了解并维护技术宪法"；底层资源名是 `adr`，Skill 里需要说清楚"当前态"和"演进历史"分别对应哪个命令）
- 更新 `xcart-project-overview`/`xcart-task-management`/`xcart-story-breakdown` 的 SKILL.md，加入"先读宪法"的步骤说明

## 7. Web UI 投影形态

按 `ai-native-product-principles.md` P1：单例文档用页面，集合里的一条记录用 Sheet。

- 技术宪法主页面——展示 `getCurrentConstitution` 的折叠结果（不是直接编辑一张状态表），提供"发起一条新 ADR"的入口（表单填 title/context/decision/changes，提交即 `POST /api/adr-records`，`status` 默认 `accepted`）。
- 某一次 ADR 的详情——Sheet（集合里一条记录的详情，符合既有 Sheet 抽屉惯例），展示 context/decision/consequences/changes 全部字段。
- 模块目录——主页面内的一个可编辑列表区块，不需要独立路由。

## 8. 遗留字段：`Project.metadata.tech_stack: string[]`

**保留原样，不自动迁移**：它是扁平字符串（"React"/"TypeScript"），没有 `layer`/`version`/`rationale`，无法无损映射到新的 `TechStackEntry[]`；且仍被 `project-edit-dialog.tsx`/`ProjectRepository` 等现存代码引用，贸然改动是与本次无关的破坏性变更。实现阶段只需：在 `packages/shared/src/types/project.ts` 对应字段加 `@deprecated` JSDoc，指向本文档；项目所有者首次创建技术宪法时手动重新录入结构化 `tech_stack`，作为一次性、人工确认的动作，不写自动迁移脚本。

## 9. 已知风险与待办（供实现阶段参照）

1. **折叠算法的正确性边界**：`upsert`/`remove` 的顺序完全由 `seq` 决定，实现时必须严格按 `seq` 升序应用，不能按 `created_at` 或插入顺序——这是本设计能保证"无静默丢失"的前提，实现偏离这一点就会重新引入 §3.2 想解决的问题。
2. **历史态查询（`getConstitutionAsOfMilestone`）依赖 `acceptedAt`（某条 ADR 何时首次进入 `accepted`）这一个历史事实**——不需要完整状态历史，只需要 `status_changes` 里那条 `proposed→accepted` 转移记录的时间。实现时需要一个能跨 `AdrRecord`（用 `seq` 排序）和 `status_changes`（用自己的时间戳/序号）比较先后的一致基准——不能简单假设两张表的时间戳精度一致，建议 `status_changes` 也补一个可比较的单调序号，而不是仅靠 `created_at` 做跨表比较，理由与 §3.3 引入 `seq` 完全一致。
3. **`Task.project_id` 常年为空**（story 挂载的任务，CLI 从不设置该字段）——§4 算法只依赖 `task.story_id`，不依赖 `task.project_id`，规避了这个已知的数据缺口。
4. **`packages/db` 的运行时迁移路径与 `drizzle-kit` 生成的迁移文件已经存在漂移**（`client.ts` 手动镜像的 `CREATE TABLE IF NOT EXISTS` 与 `migrations/*.sql` 不完全同步）——新增 `adr_records` 表、`milestones.adr_id`、`user_stories.affected_modules`、`tasks.affected_modules` 时，两条路径必须同步改，且首次 `db:generate` 会顺带把历史漂移一起纳入，需要在 PR 描述里说明。
5. **模块目录本身会漂移**：`SystemModule` 是人工维护的元数据，代码结构变了、目录没跟着更新，就会重演"文档与代码不一致"的问题（参见 `ai-native-product-principles.md` §4 关于 MCP 文档冲突的教训）。建议在技术宪法的 Skill 里加一条提示：Agent 完成涉及模块结构调整的任务后，检查是否需要顺带更新 `modules` 目录。
6. **实现顺序建议**：`packages/shared` → `packages/db`（含迁移）→ `apps/server` → `apps/cli` → `skills/` → `apps/web` → `docs/README` 更新，与 §6 的"消费面必须首发即接入"对应——CLI 和 Skills 层不能拖到最后。

## 10. 下一步

按 `x-cart` 强制项目管理约束，实现前需要在 x-cart 任务板登记对应 US/task（本仓库已自托管在 xcart 项目 `X-Cartographer-Dev`，见 `AGENTS.md`），再按 §9.6 的顺序展开文件级实现。
