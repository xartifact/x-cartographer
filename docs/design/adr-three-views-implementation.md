# 实施 ADR：三视图与交付追溯（切片 A 前置）

## 状态

`proposed` —— 由 Agent 依据 `docs/design/post-1.0-three-views.md` 推断登记（`provenance=agent_inferred`）。
**本 ADR 生效前，不创建任何实施任务**（设计文档 §12：「具体实施任务在切片方案接受后再拆解」）。
升格动作：`xcart adr status ADR-xxxx accepted --reason "<依据>"`（§4.4 状态机即权限模型，执行者不限人/Agent）。

## 背景

1.0 之后的三视图方案（`post-1.0-three-views.md`）已在 MS-025 登记 17 条故事（切片 A/B/C）。
但该文档 §11 明确要求：**「实施前需形成针对这些差异的明确 ADR；本文件不修改现行权威规则。」**
而生产库当前 **0 条 ADR**——门禁未过，实施任务不应拆解。

本 ADR 把设计文档中**已定但分散**的规则收拢为可折叠的架构原则，使 Agent 通过
`xcart adr current` / `xcart story info` 即可获得约束，而不必读完整设计文档。

## 决策

采用设计文档 §2 的三条边界，并把 §11 的差异表落为九条可执行原则：

| 原则 | 强度 | 来源 |
|---|---|---|
| `three-views-single-fact` | MUST | §2.2 三视图共享实体身份，导航切换不复制需求 |
| `affected-modules-is-impact-not-allocation` | MUST_NOT | §11 差异 2（也是 US-166 文案钉死的依据） |
| `system-composition-keeps-identity` | MUST | §4.2 / §11 差异 1 |
| `no-fabricated-history` | MUST_NOT | §6 / §11 差异 9（US-217 与 US-245 冲突的裁定依据） |
| `verification-evidence-is-independent` | MUST | §7 / §11 差异 4、8 |
| `task-completion-does-not-satisfy-requirement` | MUST_NOT | §5 关系表 + §7 |
| `context-no-silent-omission` | MUST | §13 第 5 项 / §9.1 |
| `constraint-revision-cas` | MUST | §6；复用 US-123 已落地的 DevTask CAS 模式 |
| `relation-edges-declared-and-acyclic-where-required` | SHOULD | §5 |

## 明确不做（范围内否定的项）

- **不内置 LLM、不建 MCP Server、不做 CI/CD/CAD/仿真/设备控制**（§2.6）——保存外部工具的引用与结果。
- **不新建与 `system_modules` 并行的权威目录**（§4.2）。
- **不恢复 `changes.modules`**（`domain-model.md` §6.4 已移除）。
- **不把三视图做成域隔离墙**——约束/工作/证据三空间的规定写入语义不变（`domain-model.md` §2）。
- **本轮不引入 `proposed` 新枚举**（§11 差异 7；高影响非人主张的落点问题见 `domain-model.md` §6.7，另行裁定）。

## 与既有设计的关系

| 文档 | 关系 |
|---|---|
| `post-1.0-three-views.md` | 上位设计。本 ADR 是其 §11 要求的那份「明确 ADR」，不替代它 |
| `domain-model.md` | 不变。三空间写入语义继续有效；本 ADR 的原则不改变约束/工作/证据的边界 |
| `technical-constitution.md` | 一致。本 ADR 的 changes 用同一套 `architecture_principles` 机制，不新铸载体 |
| `story-map-redesign.md` / `relationship-visualization.md` | 下位。其 §4 矩阵、§5 时间线按本 ADR 的 `affected-modules-is-impact-not-allocation` 复核 |

## 后果

- **正面**：切片 A 的准入门禁被满足；Agent 无需读长文档即可获知边界；US-217/US-245 的冲突有裁定依据。
- **代价**：九条原则会增加 `story info` 的 `relevant_principles` 输出量——但它们多数带 `module_ids` 或为全局 MUST，属预期内的信息注入。
- **风险**：本 ADR 由 Agent 推断登记，可能与负责人心中的边界有偏差。**故落 `proposed` 而非直接 `accepted`**——升格前不应据此拆解任务。

## 待负责人确认的事项（升格前）

1. 九条原则是否完整覆盖 §11 差异表（有无遗漏或过度收拢）？
2. 切片 A 是否按设计文档顺序实施（`US-233 场景` / `US-236 组成` / `US-239 修订` 可并行起步，因三者无跨故事依赖）？
3. §13 五项待收敛事项中，哪几项必须在切片 A 实施任务创建**之前**收敛（设计文档说「在对应实施任务就绪前」）？
