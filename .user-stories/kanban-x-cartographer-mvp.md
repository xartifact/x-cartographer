# X-Cartographer - Kanban 看板

**项目**: X-Cartographer
**创建日期**: 2025-01-07
**最后更新**: 2026-08-16
**总任务数**: 130
**WIP 限制**: In Progress (5) | In Review (3) | Testing (2)

---

## 📝 To Do（待开始）

### 用户故事标准格式编辑 (P0)

#### TASK-031: 创建用户故事表单组件 `P0` `3h`
- **类型**: user_story
- **描述**: 包含角色、功能、价值三个字段，自动生成标准格式故事
- **关联故事**: US-004
- **标签**: ui, form

#### TASK-032: 实现用户故事 ID 自动生成 `P0` `2h`
- **类型**: user_story
- **描述**: 为新创建的用户故事自动分配唯一 ID（US-XXX）
- **依赖**: TASK-031
- **关联故事**: US-004
- **标签**: data, id-generation

#### TASK-033: 实现详细描述和验收标准输入 `P0` `3h`
- **类型**: user_story
- **描述**: 提供富文本编辑器用于详细描述，列表输入用于验收标准
- **依赖**: TASK-031
- **关联故事**: US-004
- **标签**: ui, input

#### TASK-034: 实现用户故事优先级选择 `P0` `2h`
- **类型**: user_story
- **描述**: 提供下拉菜单或单选按钮选择优先级（high/medium/low）
- **依赖**: TASK-031
- **关联故事**: US-004
- **标签**: ui, priority

#### TASK-035: 实现用户故事关联到旅程 `P0` `2h`
- **类型**: user_story
- **描述**: 允许选择用户故事所属的用户旅程
- **依赖**: TASK-031
- **关联故事**: US-004
- **标签**: ui, relation

---

## 📋 Backlog（待规划）

### 需求分析增强 (P2)

#### TASK-014: 实现需求分析 Prompt `P2` `3h`
- **类型**: technical_task
- **描述**: 编写和测试需求分析 Prompt，能够从自然语言提取用户角色、功能点、场景
- **依赖**: TASK-013
- **关联故事**: US-002
- **标签**: ai, prompts, analysis

#### TASK-015: 实现用户旅程生成 Prompt `P2` `3h`
- **类型**: technical_task
- **描述**: 编写和测试用户旅程生成 Prompt，基于需求分析结果生成结构化旅程
- **依赖**: TASK-013
- **关联故事**: US-003
- **标签**: ai, prompts, journey

#### TASK-016: 实现验收标准生成 Prompt `P3` `3h`
- **类型**: technical_task
- **描述**: 编写和测试验收标准生成 Prompt，为用户故事自动生成 SMART 标准
- **依赖**: TASK-013
- **关联故事**: US-005
- **标签**: ai, prompts, criteria

#### TASK-027: 实现用户旅程生成 API 调用 `P2` `3h`
- **类型**: user_story
- **描述**: 基于需求分析结果，调用 LLM 生成用户旅程建议
- **依赖**: TASK-015
- **关联故事**: US-003
- **标签**: api, ai

### LLM 验收标准生成 (P3)

#### TASK-036: 实现验收标准生成 API 调用 `P3` `3h`
- **类型**: user_story
- **描述**: 调用 LLM 根据用户故事生成验收标准
- **依赖**: TASK-016
- **关联故事**: US-005
- **标签**: api, ai

#### TASK-037: 实现验收标准建议展示 `P3` `2h`
- **类型**: user_story
- **描述**: 在用户故事编辑器中显示 AI 生成的验收标准建议
- **依赖**: TASK-036
- **关联故事**: US-005
- **标签**: ui, display

#### TASK-038: 实现验收标准快速采纳 `P3` `2h`
- **类型**: user_story
- **描述**: 提供按钮一键采纳 AI 建议的验收标准
- **依赖**: TASK-037
- **关联故事**: US-005
- **标签**: ui, interaction

### 任务规划增强 (P1)

#### TASK-058: 实现任务依赖关系可视化 `P1` `3h`
- **类型**: user_story
- **描述**: 显示任务间的依赖关系，支持简单的依赖图
- **关联故事**: US-011
- **标签**: ui, visualization

#### TASK-059: 实现任务优先级设置 `P1` `2h`
- **类型**: user_story
- **描述**: 为每个任务提供优先级选择（P0/P1/P2/P3）
- **关联故事**: US-012
- **标签**: ui, priority

#### TASK-060: 实现任务工时估算输入 `P1` `2h`
- **类型**: user_story
- **描述**: 提供输入框设置每个任务的估算工时（小时）
- **关联故事**: US-012
- **标签**: ui, estimation

#### TASK-061: 实现总工时自动计算 `P1` `2h`
- **类型**: user_story
- **描述**: 根据所有任务的估算工时自动计算总计
- **关联故事**: US-012
- **标签**: logic, calculation

#### TASK-062: 实现任务依赖关系编辑 `P1` `3h`
- **类型**: user_story
- **描述**: 允许用户添加、删除、修改任务间的依赖关系
- **关联故事**: US-012
- **标签**: ui, edit

### Kanban Markdown 导出 (P0)

#### TASK-066: 实现任务列表 Markdown 序列化 `P0` `3h`
- **类型**: user_story
- **描述**: 将任务列表转换为 Kanban Markdown 格式
- **关联故事**: US-014
- **标签**: data, export

#### TASK-067: 实现任务按状态分组 `P0` `2h`
- **类型**: user_story
- **描述**: 将任务按 Backlog/To Do/In Progress/Done 等状态分组
- **依赖**: TASK-066
- **关联故事**: US-014
- **标签**: logic, grouping

#### TASK-068: 实现 Kanban Markdown 格式化 `P0` `3h`
- **类型**: user_story
- **描述**: 生成符合 Kanban 规范的 Markdown 文件，包含优先级、估算、依赖等信息
- **依赖**: TASK-067
- **关联故事**: US-014
- **标签**: data, format

#### TASK-069: 创建 Kanban 导出按钮和下载功能 `P0` `2h`
- **类型**: user_story
- **描述**: 提供导出按钮，生成 Markdown 文件并触发浏览器下载
- **依赖**: TASK-068
- **关联故事**: US-014
- **标签**: ui, download

### 质量保证与优化 (P1/P2)

#### TASK-087: 编写核心组件单元测试 `P2` `5h`
- **类型**: technical_task
- **描述**: 为关键组件编写单元测试，确保功能正确性
- **标签**: testing, unit-test

#### TASK-088: 实现错误边界和全局错误处理 `P1` `3h`
- **类型**: technical_task
- **描述**: 添加 React Error Boundary，捕获和显示友好的错误信息
- **标签**: error-handling, robustness

#### TASK-089: 性能优化：实现虚拟滚动 `P2` `3h`
- **类型**: technical_task
- **描述**: 对大量用户故事的列表实现虚拟滚动，提升性能
- **标签**: performance, optimization

#### TASK-090: 添加键盘快捷键支持 `P2` `3h`
- **类型**: technical_task
- **描述**: 实现常用操作的快捷键（如保存、导出、新建等）
- **标签**: ux, accessibility

#### TASK-091: 实现暗色主题 `P2` `3h`
- **类型**: technical_task
- **描述**: 添加暗色主题支持，用户可在设置中切换
- **标签**: ui, theme

#### TASK-092: 部署配置和 CI/CD 设置 `P1` `3h`
- **类型**: technical_task
- **描述**: 配置部署，设置自动化构建和部署流程
- **标签**: deployment, ci-cd

#### TASK-117: 编写任务状态管理功能测试 `P2` `3h`
- **类型**: technical_task
- **描述**: 为核心功能编写单元测试和集成测试
- **关联故事**: US-017
- **标签**: testing, quality

### 排期规划 (P0/P1/P2)

#### TASK-122: 设计里程碑数据模型 `P0` `3h`
- **类型**: technical_task
- **描述**: Milestone 类型 + UserStory.milestone_id，Drizzle schema + Repository
- **关联故事**: US-039
- **标签**: 排期, data-model, milestone

#### TASK-123: 实现里程碑 CRUD API `P0` `3h`
- **类型**: technical_task
- **描述**: milestones 路由（GET/POST/PATCH/DELETE）+ 状态流转
- **依赖**: TASK-122
- **关联故事**: US-039
- **标签**: 排期, api, milestone

#### TASK-124: 创建版本管理 UI 组件 `P0` `5h`
- **类型**: user_story
- **描述**: 版本列表/创建/编辑/归档对话框
- **依赖**: TASK-123
- **关联故事**: US-039
- **标签**: 排期, ui, milestone

#### TASK-125: 实现故事排期分配功能 `P0` `5h`
- **类型**: user_story
- **描述**: 故事详情面板版本选择器，PATCH story.milestone_id
- **依赖**: TASK-123
- **关联故事**: US-040
- **标签**: 排期, 故事分配

#### TASK-126: 实现批量排期操作 `P1` `3h`
- **类型**: user_story
- **描述**: 多选故事批量排入同一版本，未排期 = 待规划池
- **依赖**: TASK-125
- **关联故事**: US-040
- **标签**: 排期, 批量操作

#### TASK-127: 创建 Roadmap 路由页面 `P0` `3h`
- **类型**: user_story
- **描述**: /projects/:id/roadmap 路由 + 导航入口
- **依赖**: TASK-122, TASK-125
- **关联故事**: US-041
- **标签**: 排期, roadmap, 页面

#### TASK-128: 实现 Roadmap 泳道组件 `P0` `8h`
- **类型**: user_story
- **描述**: 按版本分组泳道：故事数/估算工时/状态/日期，待规划池置首
- **依赖**: TASK-127
- **关联故事**: US-041
- **标签**: 排期, roadmap, 可视化

#### TASK-129: 实现按版本筛选功能 `P1` `5h`
- **类型**: user_story
- **描述**: 故事地图/任务列表版本筛选器（含'未排期'）
- **依赖**: TASK-122
- **关联故事**: US-042
- **标签**: 排期, 筛选

#### TASK-130: 设计排期建议 Prompt `P2` `3h`
- **类型**: technical_task
- **描述**: 排期建议 Prompt（估算/依赖/优先级 → 版本分配）
- **依赖**: TASK-013
- **关联故事**: US-043
- **标签**: 排期, AI增强, prompt

#### TASK-131: 实现 AI 排期建议与采纳 `P2` `8h`
- **类型**: user_story
- **描述**: LLM 生成排期建议，整体采纳或逐条调整
- **依赖**: TASK-130, TASK-125
- **关联故事**: US-043
- **标签**: 排期, AI增强, 采纳

### 跨项目任务视图 (P1/P2)

#### TASK-132: 实现跨项目任务聚合 API `P1` `5h`
- **类型**: technical_task
- **描述**: 跨项目查询任务（项目/状态/优先级过滤）
- **关联故事**: US-038
- **标签**: 跨项目, api, 聚合

#### TASK-133: 创建跨项目任务视图页面 `P1` `8h`
- **类型**: user_story
- **描述**: 聚合展示所有项目任务，点击跳转所属项目
- **依赖**: TASK-132
- **关联故事**: US-038
- **标签**: 跨项目, 任务视图

#### TASK-134: 跨项目视图批量状态更新 `P2` `3h`
- **类型**: user_story
- **描述**: 聚合视图多选批量更新状态
- **依赖**: TASK-133, TASK-110
- **关联故事**: US-038
- **标签**: 跨项目, 批量操作

### 任务导入持久化与清理

#### TASK-135: 任务 TOML 导入写入数据库 `P1` `5h`
- **类型**: user_story
- **描述**: 修复任务导入仅存内存，写入数据库刷新保留
- **依赖**: TASK-076
- **关联故事**: US-011
- **标签**: bugfix, toml-import, 持久化

#### TASK-136: 清理空占位模块 `P2` `1h`
- **类型**: technical_task
- **描述**: 删除 features/export 与 onboarding 空模块
- **关联故事**: US-014
- **标签**: 清理, 结构

### 需求采纳补全 (US-037)

#### TASK-137: 实现分析结果确认与采纳交互 `P0` `5h`
- **类型**: user_story
- **描述**: 分析结果确认/修改入口，采纳后构建故事骨架
- **依赖**: TASK-025
- **关联故事**: US-037
- **标签**: 需求采纳, AI分析

#### TASK-138: 实现旅程建议批量采纳写入 `P0` `3h`
- **类型**: user_story
- **描述**: 单个/批量采纳经 saveFullProject 事务写入
- **依赖**: TASK-137
- **关联故事**: US-037
- **标签**: 需求采纳, 事务写入


## ✅ Done（已完成）

### 项目初始化与基础设施

#### TASK-001: 初始化 Next.js 项目脚手架 `P0` `2h`
- **类型**: technical_task
- **描述**: 使用 TypeScript 创建 Next.js 项目，配置基础目录结构
- **标签**: setup, infrastructure

#### TASK-002: 配置 bulletproof-react 项目结构 `P0` `3h`
- **类型**: technical_task
- **描述**: 按照 bulletproof-react 规范组织目录结构
- **依赖**: TASK-001
- **标签**: setup, architecture

#### TASK-003: 配置 ESLint 和 Prettier `P1` `2h`
- **类型**: technical_task
- **描述**: 设置代码规范工具
- **依赖**: TASK-001
- **标签**: setup, code-quality

#### TASK-004: 配置 Tailwind CSS `P0` `2h`
- **类型**: technical_task
- **描述**: 安装和配置 Tailwind CSS，设置主题和基础样式
- **依赖**: TASK-001
- **标签**: setup, styling

#### TASK-005: 设计应用主题和设计系统 `P1` `3h`
- **类型**: technical_task
- **描述**: 定义颜色、字体、间距等设计 token，创建基础 UI 组件库
- **依赖**: TASK-004
- **标签**: design, ui

### 数据模型设计

#### TASK-006: 设计项目数据模型 `P0` `2h`
- **类型**: technical_task
- **描述**: 定义 Project 类型
- **关联故事**: US-016
- **标签**: data-model, types

#### TASK-007: 设计用户旅程数据模型 `P0` `2h`
- **类型**: technical_task
- **描述**: 定义 UserJourney 类型
- **依赖**: TASK-006
- **关联故事**: US-003
- **标签**: data-model, types

#### TASK-008: 设计用户故事数据模型 `P0` `2h`
- **类型**: technical_task
- **描述**: 定义 UserStory 类型
- **依赖**: TASK-007
- **关联故事**: US-004
- **标签**: data-model, types

#### TASK-009: 设计任务数据模型 `P0` `2h`
- **类型**: technical_task
- **描述**: 定义 Task 类型
- **依赖**: TASK-008
- **关联故事**: US-011
- **标签**: data-model, types

#### TASK-010: 创建 TOML 数据解析工具 `P0` `3h`
- **类型**: technical_task
- **描述**: 实现 TOML 格式的序列化和反序列化功能
- **依赖**: TASK-006, TASK-007, TASK-008, TASK-009
- **关联故事**: US-013
- **标签**: data, parser

### LLM 集成基础设施

#### TASK-011: 创建 LLM API 客户端封装 `P2` `3h`
- **类型**: technical_task
- **描述**: 封装 LLM API（OpenAI/Anthropic/X-Herald），提供统一接口
- **关联故事**: US-002
- **标签**: ai, api, integration

#### TASK-012: 实现 API 密钥配置管理 `P2` `3h`
- **类型**: technical_task
- **描述**: API 密钥服务端存储（app_settings 表）
- **关联故事**: US-018
- **标签**: security, config

#### TASK-013: 设计 LLM Prompt 模板系统 `P2` `3h`
- **类型**: technical_task
- **描述**: 创建可复用的 Prompt 模板
- **关联故事**: US-002
- **标签**: ai, prompts

### 需求输入界面与 AI 需求分析

#### TASK-017: 实现任务拆解 Prompt `P2` `3h`
- **类型**: technical_task
- **描述**: 编写和测试任务拆解 Prompt
- **关联故事**: US-011
- **标签**: ai, prompts, tasks

#### TASK-018: 创建需求输入组件 `P0` `3h`
- **类型**: user_story
- **描述**: 实现多行文本输入框，支持 Markdown 格式
- **关联故事**: US-001
- **标签**: ui, input

#### TASK-019: 实现 Markdown 实时预览 `P1` `3h`
- **类型**: user_story
- **描述**: 集成 Markdown 解析库，提供分屏实时预览功能
- **依赖**: TASK-018
- **关联故事**: US-001
- **标签**: ui, markdown

#### TASK-020: 实现需求草稿自动保存 `P0` `2h`
- **类型**: user_story
- **描述**: 自动保存用户输入内容，防止数据丢失
- **依赖**: TASK-018
- **关联故事**: US-001
- **标签**: data, persistence

#### TASK-021: 创建需求分析触发按钮 `P0` `1h`
- **类型**: user_story
- **描述**: 添加'分析需求'按钮，触发 LLM 分析流程
- **依赖**: TASK-018
- **关联故事**: US-001
- **标签**: ui, button

#### TASK-022: 实现需求分析 API 调用 `P2` `3h`
- **类型**: user_story
- **描述**: 调用 LLM API 分析用户输入文本，返回结构化结果
- **依赖**: TASK-011, TASK-021
- **关联故事**: US-002
- **标签**: api, ai

#### TASK-023: 实现需求分析结果解析 `P2` `2h`
- **类型**: user_story
- **描述**: 解析 LLM 返回的 JSON 结果
- **依赖**: TASK-022
- **关联故事**: US-002
- **标签**: data, parser

#### TASK-024: 创建需求分析结果展示组件 `P2` `3h`
- **类型**: user_story
- **描述**: 结构化卡片展示分析结果
- **依赖**: TASK-023
- **关联故事**: US-002
- **标签**: ui, display

#### TASK-025: 实现分析结果编辑功能 `P2` `3h`
- **类型**: user_story
- **描述**: 允许用户修改、删除、添加分析结果中的条目
- **依赖**: TASK-024
- **关联故事**: US-002
- **标签**: ui, edit

#### TASK-026: 添加分析过程加载状态 `P3` `2h`
- **类型**: user_story
- **描述**: 显示加载动画和进度提示
- **依赖**: TASK-022
- **关联故事**: US-002
- **标签**: ui, loading

### 用户旅程生成

#### TASK-028: 创建用户旅程列表组件 `P0` `3h`
- **类型**: user_story
- **描述**: 展示生成的用户旅程列表
- **关联故事**: US-003
- **标签**: ui, list

#### TASK-029: 实现用户旅程编辑器 `P0` `3h`
- **类型**: user_story
- **描述**: 允许用户修改旅程名称、描述、添加/删除步骤
- **依赖**: TASK-028
- **关联故事**: US-003
- **标签**: ui, edit

#### TASK-030: 实现旅程优先级调整 `P0` `2h`
- **类型**: user_story
- **描述**: 支持为每个旅程设置优先级
- **依赖**: TASK-029
- **关联故事**: US-003
- **标签**: ui, priority

### 故事地图可视化

#### TASK-039: 设计故事地图布局算法 `P0` `3h`
- **类型**: technical_task
- **描述**: 实现二维布局算法（React Flow 列/行索引）
- **关联故事**: US-007
- **标签**: algorithm, layout

#### TASK-040: 创建故事卡片组件 `P0` `3h`
- **类型**: user_story
- **描述**: 故事卡片：标题/优先级色条/状态徽章/估算/标签/任务进度
- **关联故事**: US-007
- **标签**: ui, component

#### TASK-041: 实现故事地图画布组件 `P0` `5h`
- **类型**: user_story
- **描述**: React Flow 画布：旅程头+故事节点+连线+缩放平移
- **依赖**: TASK-039, TASK-040
- **关联故事**: US-007
- **标签**: ui, canvas, visualization

#### TASK-042: 实现地图缩放和平移功能 `P0` `3h`
- **类型**: user_story
- **描述**: 鼠标滚轮缩放、拖拽平移画布
- **依赖**: TASK-041
- **关联故事**: US-007
- **标签**: ui, interaction

#### TASK-043: 实现响应式布局 `P1` `3h`
- **类型**: user_story
- **描述**: 适配不同屏幕尺寸
- **依赖**: TASK-041
- **关联故事**: US-007
- **标签**: ui, responsive

### 拖拽交互

#### TASK-044: 实现拖拽功能基础设施 `P1` `3h`
- **类型**: technical_task
- **描述**: React Flow 原生拖拽 + 列/行索引计算
- **依赖**: TASK-041
- **关联故事**: US-008
- **标签**: ui, drag-drop

#### TASK-045: 实现故事卡片拖拽移动 `P1` `3h`
- **类型**: user_story
- **描述**: 卡片在不同旅程和优先级间移动
- **依赖**: TASK-044
- **关联故事**: US-008
- **标签**: ui, drag-drop

#### TASK-046: 实现拖拽视觉反馈 `P1` `2h`
- **类型**: user_story
- **描述**: 幽灵节点、放置指示器
- **依赖**: TASK-045
- **关联故事**: US-008
- **标签**: ui, visual-feedback

#### TASK-047: 实现拖拽后自动保存 `P1` `2h`
- **类型**: user_story
- **描述**: 拖拽后 PATCH order/journey_id 持久化
- **依赖**: TASK-045
- **关联故事**: US-008
- **标签**: data, persistence

### 详情面板与筛选

#### TASK-048: 创建故事详情面板组件 `P0` `3h`
- **类型**: user_story
- **描述**: 侧栏详情面板（描述/验收标准/标签/任务 Tab）
- **关联故事**: US-009
- **标签**: ui, panel

#### TASK-049: 实现卡片点击事件处理 `P0` `2h`
- **类型**: user_story
- **描述**: 点击卡片打开详情面板
- **依赖**: TASK-040, TASK-048
- **关联故事**: US-009
- **标签**: ui, interaction

#### TASK-050: 实现详情面板内容渲染 `P0` `3h`
- **类型**: user_story
- **描述**: 展示完整用户故事信息与关联任务
- **依赖**: TASK-048
- **关联故事**: US-009
- **标签**: ui, display

#### TASK-051: 创建筛选器组件 `P1` `3h`
- **类型**: user_story
- **描述**: 筛选面板：搜索/优先级/状态/旅程多选/重置
- **关联故事**: US-010
- **标签**: ui, filter

#### TASK-052: 实现筛选逻辑 `P1` `3h`
- **类型**: user_story
- **描述**: 四维筛选（priority/journey/status/search）
- **依赖**: TASK-051
- **关联故事**: US-010
- **标签**: logic, filter

#### TASK-053: 实现筛选结果实时更新 `P1` `2h`
- **类型**: user_story
- **描述**: 筛选条件变化实时更新地图
- **依赖**: TASK-052
- **关联故事**: US-010
- **标签**: ui, update

### AI 任务拆解

#### TASK-054: 实现任务拆解 API 调用 `P0` `3h`
- **类型**: user_story
- **描述**: 调用 LLM 将用户故事拆解为任务（TASK id 预生成 + 依赖解析）
- **关联故事**: US-011
- **标签**: api, ai

#### TASK-055: 实现任务拆解结果解析 `P0` `3h`
- **类型**: user_story
- **描述**: 解析任务列表与依赖关系
- **依赖**: TASK-054
- **关联故事**: US-011
- **标签**: data, parser

#### TASK-056: 创建任务列表展示组件 `P0` `3h`
- **类型**: user_story
- **描述**: 任务列表展示
- **依赖**: TASK-055
- **关联故事**: US-011
- **标签**: ui, list

#### TASK-057: 实现任务分类标识 `P0` `2h`
- **类型**: user_story
- **描述**: 颜色/图标区分任务类型
- **依赖**: TASK-056
- **关联故事**: US-011
- **标签**: ui, visual

### TOML 导出与导入

#### TASK-063: 实现用户故事地图 TOML 序列化 `P0` `3h`
- **类型**: user_story
- **描述**: 故事地图数据转换为 TOML 格式
- **依赖**: TASK-010
- **关联故事**: US-013
- **标签**: data, export

#### TASK-064: 创建 TOML 导出按钮和下载功能 `P0` `2h`
- **类型**: user_story
- **描述**: 导出按钮 + Blob 下载
- **依赖**: TASK-063
- **关联故事**: US-013
- **标签**: ui, download

#### TASK-065: 实现 TOML 格式验证 `P0` `2h`
- **类型**: user_story
- **描述**: 导入前验证 TOML 格式正确性
- **依赖**: TASK-063
- **关联故事**: US-013
- **标签**: validation, error-handling

### 项目管理

#### TASK-070: 创建项目列表页面 `P1` `3h`
- **类型**: user_story
- **描述**: 项目 CRUD 卡片列表
- **关联故事**: US-015
- **标签**: ui, page

#### TASK-071: 实现项目创建表单 `P1` `3h`
- **类型**: user_story
- **描述**: 项目名称、描述输入创建
- **依赖**: TASK-070
- **关联故事**: US-015
- **标签**: ui, form

#### TASK-072: 实现项目切换功能 `P1` `3h`
- **类型**: user_story
- **描述**: 项目间切换加载对应数据
- **依赖**: TASK-070
- **关联故事**: US-015
- **标签**: ui, navigation

#### TASK-073: 实现项目重命名和删除 `P1` `2h`
- **类型**: user_story
- **描述**: 修改项目信息和删除（需确认）
- **依赖**: TASK-070
- **关联故事**: US-015
- **标签**: ui, crud

### 数据持久化

#### TASK-074: 实现数据持久化 `P0` `3h`
- **类型**: user_story
- **描述**: 项目数据保存（PGlite 前身 localStorage 方案）
- **关联故事**: US-016
- **标签**: data, persistence

#### TASK-075: 实现项目数据加载 `P0` `2h`
- **类型**: user_story
- **描述**: 启动时加载项目数据
- **依赖**: TASK-074
- **关联故事**: US-016
- **标签**: data, loading

#### TASK-076: 实现 TOML 文件导入功能 `P0` `3h`
- **类型**: user_story
- **描述**: 上传 TOML 文件解析导入为项目
- **依赖**: TASK-010
- **关联故事**: US-016
- **标签**: data, import

#### TASK-077: 实现数据验证和错误处理 `P0` `3h`
- **类型**: user_story
- **描述**: 加载导入数据时验证完整性
- **依赖**: TASK-075, TASK-076
- **关联故事**: US-016
- **标签**: validation, error-handling

### 系统配置

#### TASK-078: 创建设置页面 `P0` `3h`
- **类型**: user_story
- **描述**: 设置页面（多 Provider 配置）
- **关联故事**: US-018
- **标签**: ui, settings

#### TASK-079: 实现 API 密钥输入和保存 `P0` `3h`
- **类型**: user_story
- **描述**: Provider 密钥配置（服务端 app_settings 存储）
- **关联故事**: US-018
- **标签**: security, config

#### TASK-080: 实现 LLM 模型选择 `P0` `2h`
- **类型**: user_story
- **描述**: 模型与端点配置
- **依赖**: TASK-078
- **关联故事**: US-018
- **标签**: ui, config

#### TASK-081: 实现 API 连接测试功能 `P0` `3h`
- **类型**: user_story
- **描述**: 测试按钮验证 API 配置
- **依赖**: TASK-079
- **关联故事**: US-018
- **标签**: api, validation

#### TASK-082: 实现 API 使用量统计 `P1` `3h`
- **类型**: user_story
- **描述**: API 调用与用量统计
- **关联故事**: US-018
- **标签**: analytics, monitoring

### 快速入门

#### TASK-083: 创建快速入门向导组件 `P1` `3h`
- **类型**: user_story
- **描述**: 多步骤引导组件
- **关联故事**: US-019
- **标签**: ui, onboarding

#### TASK-084: 编写快速入门内容 `P1` `3h`
- **类型**: user_story
- **描述**: 核心功能使用说明
- **依赖**: TASK-083
- **关联故事**: US-019
- **标签**: content, documentation

#### TASK-085: 创建示例项目模板 `P1` `3h`
- **类型**: user_story
- **描述**: 预置示例项目
- **关联故事**: US-019
- **标签**: data, template

#### TASK-086: 实现向导跳过和重新查看功能 `P1` `2h`
- **类型**: user_story
- **描述**: 跳过向导并在设置中重新打开
- **依赖**: TASK-083
- **关联故事**: US-019
- **标签**: ui, navigation

### 研发任务管理（状态流转/批量/进度）

#### TASK-101: 设计任务状态数据模型扩展 `P0` `3h`
- **类型**: technical_task
- **描述**: 扩展 Task/UserStory 类型添加状态字段，定义 status_changes 表
- **关联故事**: US-017
- **标签**: data-model, types

#### TASK-102: 创建状态标签组件 `P0` `2h`
- **类型**: technical_task
- **描述**: StatusBadge 组件
- **依赖**: TASK-101
- **关联故事**: US-017
- **标签**: ui, component

#### TASK-103: 创建任务状态管理 Store `P0` `3h`
- **类型**: technical_task
- **描述**: Zustand Store
- **依赖**: TASK-101
- **关联故事**: US-017
- **标签**: store, state

#### TASK-104: 在任务列表组件中添加状态标签 `P0` `2h`
- **类型**: user_story
- **描述**: task-list.tsx 集成 StatusBadge
- **依赖**: TASK-102, TASK-103
- **关联故事**: US-017
- **标签**: ui, task

#### TASK-105: 在故事卡片中添加状态标签 `P0` `2h`
- **类型**: user_story
- **描述**: StoryCard 集成 StatusBadge
- **依赖**: TASK-102
- **关联故事**: US-017
- **标签**: ui, story

#### TASK-106: 在故事地图画布中添加状态概览 `P0` `3h`
- **类型**: user_story
- **描述**: StatusOverview 组件
- **依赖**: TASK-105
- **关联故事**: US-017
- **标签**: ui, visualization

#### TASK-107: 创建项目进度统计组件 `P1` `3h`
- **类型**: user_story
- **描述**: ProgressStats 组件（任务/故事双维度）
- **依赖**: TASK-103
- **关联故事**: US-035
- **标签**: ui, dashboard

#### TASK-108: 实现任务状态切换功能 `P0` `3h`
- **类型**: user_story
- **描述**: StatusSelect 组件 + 状态变更历史
- **依赖**: TASK-103
- **关联故事**: US-017
- **标签**: ui, interaction

#### TASK-109: 实现用户故事状态切换功能 `P0` `2h`
- **类型**: user_story
- **描述**: StoryCard 集成 StatusSelect
- **依赖**: TASK-108
- **关联故事**: US-017
- **标签**: ui, interaction

#### TASK-110: 实现批量状态更新功能 `P1` `3h`
- **类型**: user_story
- **描述**: BulkUpdateDialog（含原因）
- **依赖**: TASK-108
- **关联故事**: US-034
- **标签**: ui, bulk

#### TASK-111: 实现状态变更历史记录功能 `P2` `4h`
- **类型**: user_story
- **描述**: StatusHistory + status-change.repository
- **依赖**: TASK-103
- **关联故事**: US-017
- **标签**: audit, history

#### TASK-112: 创建状态筛选器组件 `P0` `2h`
- **类型**: technical_task
- **描述**: StatusFilter 组件
- **依赖**: TASK-102
- **关联故事**: US-017
- **标签**: ui, filter

#### TASK-113: 在任务列表中添加状态筛选 `P0` `2h`
- **类型**: user_story
- **描述**: TasksPage 集成 StatusFilter
- **依赖**: TASK-112
- **关联故事**: US-017
- **标签**: ui, task

#### TASK-114: 在故事地图中添加状态筛选 `P0` `2h`
- **类型**: user_story
- **描述**: 故事地图视图集成 StatusFilter
- **依赖**: TASK-112, TASK-105
- **关联故事**: US-017
- **标签**: ui, story

#### TASK-115: 实现状态视图切换功能 `P1` `2h`
- **类型**: user_story
- **描述**: ViewSwitcher（list/kanban/board）
- **依赖**: TASK-112
- **关联故事**: US-017
- **标签**: ui, view

#### TASK-116: 实现筛选预设保存功能 `P2` `3h`
- **类型**: user_story
- **描述**: PresetManager（预设保存/导入导出）
- **依赖**: TASK-112
- **关联故事**: US-017
- **标签**: feature, preset

### 数据库持久化升级（PGlite/Drizzle）

#### TASK-118: 集成 PGlite 浏览器端数据库 `P0` `4h`
- **类型**: technical_task
- **描述**: @electric-sql/pglite + 崩溃恢复 + 自动建表
- **关联故事**: US-021
- **标签**: 数据库, PGlite

#### TASK-119: 定义 Drizzle ORM Schema `P0` `3h`
- **类型**: technical_task
- **描述**: Drizzle schema（projects/user_journeys/user_stories/tasks/status_changes）
- **关联故事**: US-022
- **标签**: Drizzle, schema

#### TASK-120: 实现 Repository 数据访问层 `P0` `5h`
- **类型**: technical_task
- **描述**: Repository 层（project/journey/story/task/status-change）
- **依赖**: TASK-119
- **关联故事**: US-022
- **标签**: Repository, 类型安全

#### TASK-121: 修复 TOML 导入日期兼容性 `P0` `1h`
- **类型**: technical_task
- **描述**: safeDate 容错无效日期
- **关联故事**: US-023
- **标签**: 容错, TOML导入

---

## 📊 项目统计

### 任务分布

- **总任务数**: 130
- **已完成（done）**: 85 (65%)
- **待规划（backlog）**: 40 (31%)
- **待开始（todo）**: 5 (4%)

### 工时统计

- **总估算工时**: 379 小时
- **已完成工时**: 约 227 小时

### 优先级分布

- **P0**: 68 任务 (52%)
- **P1**: 35 任务 (27%)
- **P2**: 22 任务 (17%)
- **P3**: 5 任务 (4%)

### 任务类型分布

- **user_story**: 91 任务 (70%)
- **technical_task**: 39 任务 (30%)

---

## 🎯 优先级建议

### 已完成（done，85 任务）

需求分析、故事地图可视化（含拖拽）、任务拆解、研发任务管理（状态/批量/进度）、数据持久化（PGlite/Drizzle）、项目管理、系统配置。

### 下一步（todo + 高优 backlog）

1. **排期规划**（TASK-122~129）: 版本管理、故事排期、Roadmap 泳道
2. **用户故事标准格式编辑**（TASK-031~035）: 角色/功能/价值字段
3. **跨项目任务视图**（TASK-132~134）: US-038
4. **Kanban Markdown 导出**（TASK-066~069）: US-014
5. **任务导入持久化**（TASK-135）: bug 修复

### 后续（backlog）

- **AI 排期建议**（TASK-130~131）: US-043
- **任务规划增强**（TASK-058~062）: 依赖可视化/编辑
- **LLM 验收标准生成**（TASK-036~038）: US-005
- **需求采纳补全**（TASK-137~138）: US-037
- **帮助文档与测试**（TASK-087~092）: 质量保障
---

## 📝 使用说明

### Kanban 工作流

1. **Backlog → To Do**: 需求评审后移至 To Do
2. **To Do → In Progress**: 开发开始前移至 In Progress（注意 WIP 限制）
3. **In Progress → In Review**: 代码提交后移至 In Review
4. **In Review → Testing**: 代码审查通过后移至 Testing
5. **Testing → Done**: QA 验证通过后移至 Done

### 依赖管理

- 开始任务前确保所有依赖任务已完成
- 依赖关系标注在每个任务的**依赖**字段中
- 关键路径任务优先处理，避免阻塞后续工作

### 优先级规则

- **P0**: 必须完成，阻塞其他任务或核心功能
- **P1**: 重要功能，提升用户体验
- **P2**: 优化和完善，时间允许时处理
- **P3**: 低优先级，长期规划

---

**文档版本**: 2.0
**最后更新**: 2026-08-16
