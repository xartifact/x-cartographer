# 文档参考

## 项目文档 (`.docs/`)

### 快速开始指南
**文件**: `.docs/快速开始指南.md`

内容：
- 环境要求 (Node.js 20, pnpm 9)
- Next.js 项目创建步骤
- 核心依赖安装命令
- shadcn/ui 初始化配置
- 目录结构创建
- 配置文件示例 (tsconfig, tailwind, eslint, prettier)
- 开发服务器启动

### 架构设计文档
**文件**: `.docs/架构设计-项目脚手架与技术栈.md`

内容：
- 技术架构图
- 完整目录结构
- 技术栈选型理由
- 依赖库清单
- 配置文件说明
- 数据流架构
- 模块划分与职责
- 关键技术决策 (7 个决策)
- 性能优化策略
- 安全考虑
- shadcn/ui 使用指南

### 数据模型与 API 设计
**文件**: `.docs/数据模型与API设计.md`

内容：
- ER 图
- TypeScript 类型定义 (common, project, user-journey, user-story, task, llm)
- LLM Prompt 设计 (需求分析、验收标准、任务拆解)
- API 接口设计
- 存储策略
- Zod Schema 验证
- TOML 格式规范

### 产品设计文档 (`.user-stories/`)

#### 用户故事地图
**文件**: `.user-stories/story-map-x-product-roadmap-mvp.toml`

包含：
- 项目信息
- 用户旅程 (UJ-001 至 UJ-010)
- 每个旅程的用户故事 (US-001 至 US-038)

#### 任务列表
**文件**: `.user-stories/tasks-x-product-roadmap-mvp.toml`

包含：
- 92 个开发任务
- 任务类型 (user_story, technical_task, bug_fix, spike)
- 优先级 (P0-P3)
- 估算工时

#### Kanban 看板
**文件**: `.user-stories/kanban-x-product-roadmap-mvp.md`

包含：
- 任务统计 (92 任务, 248 小时)
- Backlog / To Do / In Progress / In Review / Done

#### 分析报告
**文件**: `.user-stories/x-product-roadmap-mvp-分析报告.md`

包含：
- 项目概览
- 技术栈分析
- 功能模块分析
- 开发计划 (4 周)
- 风险评估

## 重要配置文件

### package.json
- 脚本命令 (dev, build, start, lint, format, type-check)
- 依赖列表 (35+ 生产依赖, 8 开发依赖)

### tsconfig.json
- 严格模式配置
- 路径别名 (@/*, @/components/*, @/features/*, 等)

### .eslintrc.json
- Next.js + TypeScript 规则
- 自定义规则 (no-unused-vars, no-explicit-any, prefer-const)

### .prettierrc
- 代码格式化配置
- tailwindcss 插件

### next.config.js
- React Strict Mode
- Server Actions 配置
- 环境变量

## 外部参考

### 技术文档
- [Next.js 文档](https://nextjs.org/docs)
- [React Flow 文档](https://reactflow.dev/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [Zustand 文档](https://zustand.docs.pmnd.rs/)
- [TanStack Query 文档](https://tanstack.com/query/latest)
- [shadcn/ui 文档](https://ui.shadcn.com/)

### 架构参考
- [Bulletproof React](https://github.com/alan2207/bulletproof-react)

## 使用文档的场景

### 1. 新开发者加入
1. 阅读 `.docs/快速开始指南.md` 搭建环境
2. 阅读 `architecture-overview.md` 了解整体架构
3. 阅读 `code-style-and-conventions.md` 了解编码规范

### 2. 开发新功能
1. 查看 `documentation-reference.md` 找到相关文档
2. 参考 `.docs/数据模型与API设计.md` 了解类型定义
3. 查看 `.user-stories/` 了解产品需求

### 3. 代码审查
1. 参考 `code-style-and-conventions.md` 检查代码风格
2. 使用 `task-completion-checklist.md` 验证完成度

### 4. 调试问题
1. 查看 `suggested-commands.md` 运行诊断命令
2. 查看相关配置文件

### 5. 添加依赖
1. 参考 `.docs/架构设计-项目脚手架与技术栈.md` 中的依赖清单
2. 确保与现有技术栈兼容
