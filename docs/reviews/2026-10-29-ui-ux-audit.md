# X Cartographer 全模块 UI 与 UX 审查

审查日期：2026-10-29。对象为当前工作区的正式 Web 路由及其真实数据链路，包含本轮新 ADR 评审和主题改造，排除 design-preview 原型。

**结论：视觉底座已有改善，但尚不足以称为人类友好的日常工作工具。主要阻碍是操作不生效、输入丢失、保存后读到旧状态，以及入口与能力不一致。下一阶段应先修复操作可靠性，再统一交互，最后优化信息架构。**

本报告将浏览器复现、代码确认和设计判断分别标注。P1 表示核心流程阻断、输入丢失或高影响误操作；P2 表示显著困惑、流程缺口或恢复困难；P3 表示一致性优化。没有把本轮未发现 P0 理解为不存在 P0。

## 覆盖范围

所有正式顶层与产品内页面均纳入代码审查；浏览器实测使用 Safari、隔离 Web 3012/Gateway 8793，样例位于独立 /tmp 数据库。未对生产业务数据执行创建、删除、状态决定或凭据轮换。任务板仅登记本次审查 TASK-1173。

| 模块 | 检查功能 | 主要结论 | 浏览器覆盖 |
|---|---|---|---|
| 全局框架 | 导航、切产品、搜索、通知、账号、主题 | 存在未接通操作，命名与层级有混淆 | 共享导航与 AX；主题沿用上一轮验证 |
| 首页与引导 | 入口、跳过、重看、示例创建 | 入口同向，示例没有写完整结构 | 本轮代码审查 |
| 产品管理 | 列表、搜索、新建、编辑、删除、概览、导出 | 无结果搜索陷阱；上下文导出范围不足 | 产品搜索复现；表单沿用上一轮实测 |
| 并行工作台 | 聚合、筛选、多选、批量、打开任务 | 查询禁用，跨产品主流程失效 | 与 API 数量对照 |
| 故事地图 | 空态、活动/步骤/故事、拖拽、切片、筛选、批量 | 空态创建失效，列拖拽解析错误 | 有数据地图与空地图按钮 |
| 活动管理 | 搜索、新建、编辑、排序、删除 | 编辑不可达，筛选后排序错误 | 页面操作入口，400×800 布局 |
| 用户任务 | 筛选、新建、编辑、删除 | mutation 后列表缓存未更新 | 创建后零条、刷新后出现 |
| 故事管理 | 创建、标准、状态、编辑、详情、任务拆解 | 验收标准丢失，详情对象陈旧 | 填表提交并 API 读回 |
| 研发任务 | 创建、列表、Kanban、分组、依赖图、详情、批量、预设 | 失败闭环、视图筛选和编辑能力不完整 | 入口与样例列表 |
| 排期 | 版本 CRUD、泳道、故事分配、研发任务、指标 | 详情陈旧，取消口径不一致 | 默认泳道与待规划池 |
| 数据浏览 | 概览、活动展开、故事搜索筛选、明细 | 默认标签不存在，阅读能力不一致 | 首屏空内容复现 |
| 模块目录 | CRUD、依赖图、反向依赖、归属矩阵 | 写入反馈较完整；影响分析漏独立任务，图到编辑不连贯 | 空状态与三视图入口；图/矩阵代码审查 |
| ADR 技术宪法 | 队列、规则、历史、变更、预览、意见、修订、决定 | 已有明确评审链；草稿、预览顺序、检索仍需改进 | 本轮草稿丢失；完整采纳链沿用前轮隔离验收 |
| 设置 | Token 状态、生成、复制、轮换、撤销、重看引导 | 轮换影响提示与已配置态操作不完整 | 代码审查，未修改凭据 |
| 横向质量 | 错误/加载/空态、草稿、键盘、移动、主题、文案 | 缺统一可执行的交互规则 | AX 与窄屏抽查；并非完整无障碍认证 |

覆盖“所有模块”不等于穷尽每个状态组合。本轮没有逐一注入所有网络故障，没有执行不可恢复删除、凭据轮换，没有完成全浏览器、全屏幕阅读器、大规模图性能测试。上述路径的结论保留为代码证据，不能冒充浏览器实测。

## 需要修复的问题

### UX-01 P1 故事创建会静默丢失验收标准

证据：浏览器与 API 读回。

在“故事管理”新建故事，填写验收标准 `UX-AUDIT-AC 必须保存` 并提交。弹窗正常关闭，但 US-002 的 `acceptance_criteria` 读回为 `[]`。页面直接传 `acceptance_criteria`，hook 透传，服务端只接收 `acceptanceCriteria`。用户丢失的是验收依据。修复：在提交边界显式映射字段，并补“UI 填写→保存→重开/读回”行为验证。

定位：[stories-page.tsx:107](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/user-stories/components/stories-page.tsx:107)；[use-stories.ts:76](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/lib/api/hooks/use-stories.ts:76)；[stories.ts:21](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/server/src/routes/stories.ts:21)。

### UX-02 P1 并行工作台不查询跨产品任务

证据：浏览器与 API 对照。

隔离 API `/api/dev-tasks/all` 返回 1 条任务，刷新工作台仍显示 0 个产品、0 条任务。Workbench 调用 `useAllDevTasks({})`，hook 却用 `enabled: !!productId` 禁用了查询。修复：区分全局查询与产品限定查询；未限定产品时也应加载。另应区分加载失败和确实为空。

定位：[workbench-page.tsx:53](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/workbench/workbench-page.tsx:53)；[use-dev-tasks.ts:77](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/lib/api/hooks/use-dev-tasks.ts:77)。

### UX-03 P1 产品搜索无结果后失去清除搜索的入口

证据：浏览器复现。

输入不匹配关键词后，页面提示“尝试不同的搜索关键词”，但搜索框一起消失。关键词还被持久化，刷新也不能恢复正常列表。修复：工具栏始终渲染；结果区显示无匹配与“清除筛选”；不要让空结果替代操作入口。

定位：[project-list.tsx:294](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/projects/components/project-list.tsx:294)；[project-store.ts:52](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/projects/stores/project-store.ts:52)。

### UX-04 P1 新建任务或地图故事失败后仍关闭表单

证据：代码路径确认。

任务页 handleCreateTask 和地图 handleCreateStory 捕获错误后只记日志，不重新抛出；子表单 await onSave 后仍执行关闭。网络/服务端失败会被表单当作完成，任务标题等输入被清除。全局 mutation onError 也只写 console。修复：提交函数返回明确成功结果或抛错，失败保持全部字段和焦点，呈现可读错误与重试。

定位：[tasks-page.tsx:322](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/tasks-page.tsx:322)；[task-create-dialog.tsx:94](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/task-create-dialog.tsx:94)；[patron-canvas.tsx:758](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/components/patron-canvas.tsx:758)；[main.tsx:22](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/main.tsx:22)。

### UX-05 P1 用户任务保存后列表不刷新

证据：浏览器复现。

新建“UX 审查 用户任务刷新”成功后，列表仍为 0，手动刷新才显示 UT-001。列表查询 key 为 user-tasks/product/productId，而创建、编辑、删除没有失效这个 key。容易诱发重复创建。修复：统一关联查询失效，显示逐行 pending 和成功反馈；失败不能只留下 rejected promise。

定位：[use-user-tasks.ts:32](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/lib/api/hooks/use-user-tasks.ts:32)；[use-user-tasks.ts:91](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/lib/api/hooks/use-user-tasks.ts:91)；[user-tasks-page.tsx:71](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/user-tasks/components/user-tasks-page.tsx:71)。

### UX-06 P1 详情抽屉保留旧对象导致保存后的结果不可见

证据：代码路径确认。

故事管理、排期和任务详情把完整实体存进 useState，查询刷新后没有按 id 重新解析。故事详情内分配版本或增加任务后，列表可以更新，但已打开的抽屉继续显示旧版本/旧任务；任务依赖保存也未更新 detailTask。修复：状态只保存 selectedId，从实时查询派生详情；保存后不要要求用户关闭再打开。地图已有 selectedStoryLive，可作为统一范式。

定位：[stories-page.tsx:53](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/user-stories/components/stories-page.tsx:53)；[roadmap-page.tsx:69](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/roadmap/roadmap-page.tsx:69)；[tasks-page.tsx:67](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/tasks-page.tsx:67)；[patron-canvas.tsx:366](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/components/patron-canvas.tsx:366)。

### UX-07 P1 空故事地图的添加活动按钮无响应

证据：浏览器复现。

新建空产品进入故事地图，点击“添加活动”，没有弹出表单。组件在 activities.length===0 时提前 return；按钮虽更新 state，ActivityCreateDialog 位于被跳过的后半段。已有活动时，地图顶部也没有新增活动入口。修复：把 Dialog 放在空/非空分支共同父层；地图持续提供“添加活动”。

定位：[patron-canvas.tsx:880](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/components/patron-canvas.tsx:880)；[patron-canvas.tsx:982](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/components/patron-canvas.tsx:982)。

### UX-08 P1 用户任务列拖拽重排的 ID 解析错误

证据：代码与最小运行验证。

实际节点 `colhead-UA-001-UT-001` 经现有 split 得到 `["UA-001-UT","001"]`，解构却要求三个值，activityId 变为 "001"、taskKey 为 undefined，随即找不到活动并返回。用户看到可拖手柄却无法持久化列顺序。修复：直接在 node.data 携带 activityId/userTaskId，不解析带分隔符的业务 ID；验证拖动后刷新顺序。

定位：[patron-canvas.tsx:644](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/components/patron-canvas.tsx:644)；[patron-layout.ts:215](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/lib/patron-layout.ts:215)。

### UX-09 P1 活动搜索状态下重排会写错全局顺序

证据：代码路径确认。

先搜索出部分活动，再上移/下移。moveActivity 对已经筛选的 activities 重新编号，并用该子集替换本地完整活动树；隐藏活动未参与编号，可能产生重复 order，刷新前还会暂时消失。修复：排序基于完整集合，明确定义筛选下的移动语义，或筛选时禁用重排并说明；失败恢复原序。

定位：[journeys-page.tsx:73](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/user-journeys/components/journeys-page.tsx:73)；[journeys-page.tsx:80](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/user-journeys/components/journeys-page.tsx:80)。

### UX-10 P1 故事内研发任务一击即永久删除

证据：代码路径确认 未执行删除。

故事详情的垃圾桶直接调用删除 API，没有确认、撤销或影响说明。它紧邻日常状态操作，并且按钮较小。修复：删除前显示任务标题及依赖影响；提供明确确认。若设计为撤销，应先有可恢复的数据机制，不能只画一个撤销按钮。

定位：[story-task-panel.tsx:88](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/components/story-task-panel.tsx:88)；[story-task-panel.tsx:303](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/components/story-task-panel.tsx:303)。

### UX-11 P1 Token 重新生成缺少旧凭据失效提示

证据：前后端代码确认 未轮换凭据。

“重新生成 Token”直接调用 POST，服务端覆盖原 token；用户未看到“现有 Agent/CI 将立即失效”的确认。刷新后 token 明文消失，撤销按钮也随之消失，只有重新生成入口。加载/失败阶段还会被显示成“未配置”。修复：已配置状态始终可撤销；轮换前交代影响；区分未知、已配置、未配置；复制失败提供反馈。

定位：[api-token-settings.tsx:21](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/settings/components/api-token-settings.tsx:21)；[api-token-settings.tsx:64](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/settings/components/api-token-settings.tsx:64)；[settings.ts:19](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/server/src/routes/settings.ts:19)。

### UX-12 P1 批量操作提前关闭且不能解释部分成功

证据：代码路径确认。

确认按钮同步调用 async onConfirm 后立即关闭；多条写入用 Promise.all，其中一条失败时其他可能已成功，页面没有逐项结果或“仅重试失败项”。用户无法判断该不该再点一次。当前状态只取一条，混合状态也被画成单一状态；文案误称“更新产品”。修复：await 结果、禁用重复提交、汇总成功/失败 ID，保留失败选择和原因。

定位：[bulk-update-dialog.tsx:170](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/bulk-update-dialog.tsx:170)；[tasks-page.tsx:200](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/tasks-page.tsx:200)；[workbench-page.tsx:125](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/workbench/workbench-page.tsx:125)。

### UX-13 P1 长表单缺少未保存保护 新版 ADR 也会丢草稿

证据：ADR 浏览器复现 其他表单代码确认。

发起 ADR，输入标题后按 Esc，再打开标题为空。新建/修订表单打开时重新初始化；评论的“稍后继续”仅在当前 Sheet 生命周期有效，关闭 Sheet 因 key 变化会卸载草稿。产品、任务、版本等表单也缺统一 dirty-dismiss 保护。MarkdownField 只覆盖部分描述字段，不是完整表单恢复。修复：以产品/实体/用途保存草稿；关闭时提供保留、丢弃、继续编辑；明确“稍后继续”的保存范围。

定位：[adr-create-dialog.tsx:88](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/constitution/components/adr-create-dialog.tsx:88)；[constitution-page.tsx:238](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/constitution/components/constitution-page.tsx:238)；[adr-revision-sheet.tsx:67](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/constitution/components/adr-revision-sheet.tsx:67)；[task-create-dialog.tsx:69](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/task-create-dialog.tsx:69)。

### UX-14 P2 全局存在看起来能用但未实现的入口

证据：代码确认。

Header 搜索框和移动搜索没有查询行为；通知和退出登录没有操作；个人资料链接指向路由树中不存在的 /profile；默认显示 user@example.com。顶部 ⌘K 暗示全局搜索，但仅任务页接入页面搜索。修复：只展示已实现能力，统一快捷键语义；没有账号体系时不模拟账号状态。

定位：[Header.tsx:91](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/components/layout/Header.tsx:91)；[Header.tsx:161](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/components/layout/Header.tsx:161)；[routeTree.ts:43](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/routeTree.ts:43)。

### UX-15 P2 活动管理有编辑实现但没有编辑入口

证据：浏览器与代码确认。

列表只有上移、下移、删除，没有点击详情或编辑按钮。editing 只被清空，从未设置为某活动。用户要改名字必须去地图找另一入口。修复：列表名称可打开 Sheet，提供编辑；保持列表与地图能力一致。

定位：[journeys-page.tsx:26](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/user-journeys/components/journeys-page.tsx:26)。

### UX-16 P2 数据浏览默认选中不存在的标签页

证据：浏览器复现。

数据页已有活动和故事，但首次打开只显示统计和两个未选中的标签，没有数据列表。初始值是 overview，实际只有 activities/stories 两个 TabsContent。修复：默认活动列表，或真正实现概览面板。

定位：[data-browser-page.tsx:21](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/data-browser/components/data-browser-page.tsx:21)。

### UX-17 P2 任务筛选与视图切换语义不一致

证据：代码确认。

列表和 Kanban 消费 filteredTasks；“看板视图”直接使用 story.dev_tasks，忽略页顶搜索和状态筛选；依赖图取全量却未在筛选处解释。Kanban 列计数用全量统计，内容却是筛选结果。修复：同一筛选在各视图一致生效；为保持图上下文而扩展节点时，明确标记匹配项与上下文项。

定位：[tasks-page.tsx:495](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/tasks-page.tsx:495)；[tasks-page.tsx:539](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/tasks-page.tsx:539)；[view-switcher.tsx:58](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/view-switcher.tsx:58)。

### UX-18 P2 进度与已取消数据的统计口径不一致

证据：代码确认。

任务完成率分母包括 cancelled，但 statusStats 不累计 cancelled；概览同样只统计深树任务并含取消项。排期泳道排除未排期的 cancelled 故事，已排期列却保留它们，而可预测性统计排除它们。不同页面数字难以互相核对。修复：命名清晰的同一统计函数；显示有效、取消、完成各自口径，模块锚定任务单列说明。

定位：[tasks-page.tsx:278](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/tasks-page.tsx:278)；[roadmap-page.tsx:86](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/roadmap/roadmap-page.tsx:86)；[$productId.index.tsx:19](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/routes/products/$productId.index.tsx:19)。

### UX-19 P2 导出 AI 上下文与全景的承诺不相符

证据：代码确认。

概览“导出 AI 上下文”仅输出活动、故事标题和任务标题/状态，未包含验收标准、详细描述、ADR/生效规则、模块目录及模块锚定任务。文件自称“产品全景”，用户可能以为架构约束已经交给 Agent。修复：复用权威上下文导出能力，或明确改名“故事与任务摘要”，说明包含范围。

定位：[$productId.index.tsx:45](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/routes/products/$productId.index.tsx:45)。

### UX-20 P2 新手示例只有空产品 没有示例故事地图

证据：代码确认。

createSampleProjectData 包含示例结构，但 handleCreateSample 只创建产品名称/描述/技术栈，不写活动、故事、任务。跳转地图后用户看到空态；设置页重看向导没有传 onCreateSample，示例入口消失。首页还宣传已移除的“导入”。修复：真正落完整小型示例并保证失败可恢复；统一首访与重看入口；清理过期承诺。

定位：[onboarding-gate.tsx:50](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/onboarding/onboarding-gate.tsx:50)；[settings.tsx:46](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/routes/settings.tsx:46)；[index.tsx:21](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/routes/index.tsx:21)。

### UX-21 P2 研发任务管理缺少常用编辑与上下文直达

证据：代码确认。

新建任务必须选故事，无法创建已被领域支持的模块锚定任务；详情仅可编辑依赖，标题、描述、负责人等没有编辑入口；任务/故事状态历史组件没有接入正式页面。工作台点击任务只跳产品任务列表，不定位目标任务。修复：任务详情承载基本信息、状态、依赖与历史；使用可分享 URL 保存 taskId；创建时选择故事或模块锚点。

定位：[task-create-dialog.tsx:101](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/task-create-dialog.tsx:101)；[task-detail-sheet.tsx:50](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/task-detail-sheet.tsx:50)；[workbench-page.tsx:141](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/workbench/workbench-page.tsx:141)。

### UX-22 P2 点击徽章会直接循环修改状态

证据：代码确认。

故事列表 accepted 再点会回 backlog；故事内任务的循环不包含 in_review/testing/cancelled，这些状态点击后会回 backlog。用户无法先确认目标，也没有变更原因或撤销提示。修复：状态菜单显式列目标；重要状态提交显示目标与原因；统一列表、详情和批量操作。

定位：[stories-page.tsx:134](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/user-stories/components/stories-page.tsx:134)；[story-task-panel.tsx:236](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/components/story-task-panel.tsx:236)。

### UX-23 P2 模块矩阵漏掉模块锚定任务

证据：代码确认。

矩阵只遍历 activity→story→dev_tasks，独立模块锚定任务没有进入输入，尽管矩阵构建函数支持 module_id。工程治理工作可能完全缺席，未标注计数也不包含它们。修复：合并产品全部研发任务并按 ID 去重，明确“主锚模块”和“涉及模块”区别。

定位：[module-matrix.tsx:37](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/module-matrix/components/module-matrix.tsx:37)。

### UX-24 P2 模块图和影响面提示缺少后续行动

证据：代码确认与设计判断。

模块依赖图禁用选择，没有节点打开详情；矩阵提示 affected_modules 缺失，但正式故事/任务表单没有标注控件，矩阵行也不能直达实体。删除模块的提示只列模块反向依赖，不呈现故事/任务引用。修复：图节点打开同一 Sheet，矩阵行链接故事/任务并提供模块标注；删除先显示完整引用范围。

定位：[module-dependency-graph.tsx:184](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/system-modules/components/module-dependency-graph.tsx:184)；[module-matrix.tsx:10](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/module-matrix/components/module-matrix.tsx:10)；[system-modules-page.tsx:102](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/system-modules/components/system-modules-page.tsx:102)。

### UX-25 P2 ADR 采纳确认遮挡实际预览

证据：代码确认。

“采纳并生效”同一次点击 setTab(preview) 并打开决定 Dialog。确认框只告知影响项数，用户还没有机会阅读完整生效差异。token 验证能防陈旧提交，但不能证明用户理解影响。修复：第一步明确进入预览；预览页提供最终采纳动作，显示删除/修改和被替代 ADR，再记录理由。

定位：[adr-revision-sheet.tsx:520](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/constitution/components/adr-revision-sheet.tsx:520)；[adr-revision-sheet.tsx:610](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/constitution/components/adr-revision-sheet.tsx:610)。

### UX-26 P2 ADR 的填写与长期检索仍偏向内部模型

证据：代码确认与设计判断。

表单出现 title/context/decision、human_asserted、slug、layer、逗号分隔模块 ID；移除规则需手填 ID，缺少从当前规则选择。队列/历史没有搜索与筛选；当前规则不能直接追溯来源 ADR。修复：面向用户的中文标签与字段级验证；规则/模块选择器；按标题、ID、模块、状态检索；规则连接来源决定。短期不必增加审批角色体系。

定位：[adr-create-dialog.tsx:122](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/constitution/components/adr-create-dialog.tsx:122)；[adr-create-dialog.tsx:313](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/constitution/components/adr-create-dialog.tsx:313)；[constitution-page.tsx:23](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/constitution/components/constitution-page.tsx:23)。

### UX-27 P2 读取失败经常伪装成无数据

证据：代码确认。

多处 GET hook 未检查 res.ok；部分页面只消费 data/isLoading，错误会被默认空数组或“产品不存在或未加载”吸收。用户任务列表、工作台、排期和 Token 设置缺少清楚的重试路径。修复：统一读取错误契约；区分首次加载、刷新中、无数据、无匹配、加载失败；保留上一份可用数据并标记刷新失败。

定位：[use-products.ts:20](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/lib/api/hooks/use-products.ts:20)；[$productId.tasks.tsx:27](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/routes/products/$productId.tasks.tsx:27)；[user-tasks-page.tsx:39](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/user-tasks/components/user-tasks-page.tsx:39)。

### UX-28 P2 窄屏工具栏没有形成可用的信息层级

证据：400×800 浏览器截图。

活动页固定宽搜索框、计数、新建按钮被挤在同一横排，计数“1 活动 · 2 故事”逐字竖排，工具栏高度异常。故事/用户任务/模块页也有固定宽操作组，需逐页响应式验收。修复：窄屏拆成主操作行、全宽搜索、可折叠筛选；计数不参与挤压，横向滚动限制在图/表区域。

定位：[journeys-page.tsx:91](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/user-journeys/components/journeys-page.tsx:91)；[user-tasks-page.tsx:111](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/user-tasks/components/user-tasks-page.tsx:111)。

### UX-29 P2 核心点击区域和图标操作缺少完整键盘可访问性

证据：代码与浏览器 AX 检查。

数据卡标题用 div/CardHeader onClick 展开而没有 button/键盘处理；Kanban 卡也是点击 Card。活动移动/删除、任务删除等图标没有可访问名称；部分操作仅 group-hover 显示，没有 focus-within。故事详情未提供 SheetTitle 语义。修复：原生 button/link、明确 aria-label、可见焦点、展开状态；同样支持键盘打开、移动、关闭。此处是具体缺陷，不是完整屏幕阅读器合规结论。

定位：[story-card.tsx:54](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/data-browser/components/story-card.tsx:54)；[tasks-page.tsx:468](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/tasks-page.tsx:468)；[journeys-page.tsx:145](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/user-journeys/components/journeys-page.tsx:145)；[story-detail-panel.tsx:78](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/components/story-detail-panel.tsx:78)。

### UX-30 P2 导航按实体拆分 用户需自己推断操作顺序

证据：设计判断。

产品内十个同级入口，地图、活动、用户任务、故事、数据均呈现重叠对象；“用户任务”和“任务”容易混淆；首页三个入口都去产品列表；新产品概览没有下一步。修复：先保留能力，按“需求规划 / 执行交付 / 架构决策”分组；明确“用户步骤”和“研发任务”；空态串联创建活动→步骤→故事，常用动作就近完成。分组需要真实用户任务测试，不应只凭审美删除模块。

定位：[ProjectNav.tsx:28](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/components/layout/ProjectNav.tsx:28)；[index.tsx:6](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/routes/index.tsx:6)。

### UX-31 P2 Markdown 编辑和阅读呈现不一致

证据：代码确认。

故事描述支持 Markdown 编辑/预览，保存后的故事详情、任务详情和数据浏览却把描述作为普通文本显示。列表/表格/链接等原始标记降低评审阅读效率。修复：复用安全 Markdown renderer，统一标题、代码、长文本折叠和链接交互；源文保留在编辑模式。

定位：[story-edit-dialog.tsx:124](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/components/story-edit-dialog.tsx:124)；[story-detail-panel.tsx:145](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/components/story-detail-panel.tsx:145)；[task-detail-sheet.tsx:240](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/task-detail-sheet.tsx:240)。

### UX-32 P2 人类 UI 创建的故事被记录成 Agent 推断

证据：浏览器创建与 API 读回。

本轮通过人类表单创建的 US-002 返回 provenance=agent_inferred。故事 hook 未携带 provenance，服务端默认 agent_inferred；活动等写入口也需逐项审计。来源在 ADR 等界面又成为用户判断证据的一部分。修复：明确来自人类操作的提交带 human_asserted；Agent 生成内容不可自动伪装为人类主张。

定位：[use-stories.ts:13](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/lib/api/hooks/use-stories.ts:13)；[stories.ts:29](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/server/src/routes/stories.ts:29)。

### UX-33 P2 筛选预设导入缺少结构校验和失败反馈

证据：代码确认。

导入只判断 Array.isArray，数组元素未校验 conditions 等字段；不合法数组可进入 localStorage，再由 getMatchingPreset 解引用缺失字段。语法错误仅写日志，用户不知道导入失败。修复：校验完整 schema 和版本，明确成功/跳过/错误数量，非法内容不写入持久状态。

定位：[preset-manager.tsx:282](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/preset-manager.tsx:282)；[preset-manager.tsx:313](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/preset-manager.tsx:313)。

### UX-34 P3 主题底座统一了 业务语义样式仍有遗漏

证据：代码确认。

新 tokens、Sheet/Dialog 与主要状态徽章已统一，但故事任务面板仍直接使用 red/orange/blue/gray 色值，Token 提示使用 green/amber 字面类；状态名称有“待处理/待办池”“待开始/待执行”，任务视图还有英文 backlog/todo/done。修复：把状态文案与颜色一起收敛到共享配置，逐页验证暗色与文字对比度。此前主题测试通过只证明所测 tokens/组件，不能证明所有业务页面都统一。

定位：[story-task-panel.tsx:28](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/story-map/components/story-task-panel.tsx:28)；[api-token-settings.tsx:72](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/settings/components/api-token-settings.tsx:72)；[tasks-page.tsx:451](/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/web/src/features/tasks/components/tasks-page.tsx:451)。

## 改进顺序与验收标准

1. **先恢复可信操作。** 修 UX-01 至 UX-13：保存必须可读回；失败不能丢输入；列表与抽屉显示同一最新状态；搜索必须能退出；空产品能从第一步开始；删除和 Token 轮换必须明确影响。对这些缺陷增加跨 UI/API 的行为验证，优先覆盖已经复现的路径。
2. **再统一交互约定。** 共享表单提交结果、字段错误、dirty-dismiss、逐行 pending、批量部分失败、可重试空态与 selectedId 详情模式。这个阶段应逐模块接入，不能只建一套公共组件然后宣称完成。
3. **补齐用户工作的连续性。** 详情可直达、修改与历史在同处完成，图/矩阵链接实际实体，状态显式选择，故事和模块两种研发任务锚点都可操作。跨视图筛选与统计采用统一语义。
4. **最后调整信息架构和阅读体验。** 导航按任务分组；空产品给下一步；ADR 的“阅读变化→处理意见→预览生效→决定”顺序清晰；长文可读；移动工具栏重排；键盘路径和语义色逐页验收。

建议每个模块用同一组通过标准：第一次使用知道从哪里开始；主要动作无需猜测；保存后不刷新即可看见正确结果；错误时知道哪里失败且输入仍在；关闭/返回不会意外丢工作；键盘和窄屏可以完成主要路径；提供的数字与其他视图一致；未实现功能不伪装可用。

## 保留的设计基础

保留统一 Iris 主题与中性层级、Sheet 详情上下文、模块表单的明确错误反馈、ADR 修订链与原文保留、阻塞意见和陈旧预览校验。这些方向成立。需要补齐的是端到端交互，而不是再次全站换皮。

本轮仅产出审查报告，未修改业务实现。浏览器截图已在本次会话中展示产品搜索陷阱和 400×800 活动页布局；它们不是另存的仓库图片。此前 138 项 Web 测试与主题验证是上一轮的结果，本次不将其视为上述 UX 缺陷的通过证据。
