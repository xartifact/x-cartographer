# X-Product-Roadmap 项目概览

## 项目目的

这是一个 **AI Native 用户故事地图可视化应用**，允许用户基于 LLM 描述需求，通过 AI 进一步拆解和分析需求内容，规划用户故事。

## 核心特性

1. **AI 驱动的需求分析**: 使用 LLM 分析自然语言需求，提取用户角色、功能点、使用场景
2. **用户故事地图可视化**: 基于 React Flow 的交互式故事地图画布
3. **智能任务拆解**: 将用户故事自动拆解为可执行的开发任务
4. **多格式导出**: 支持 TOML 和 Kanban Markdown 格式导出

## 技术栈

- **框架**: Next.js 15 (App Router) + React 18 + TypeScript 5
- **样式**: Tailwind CSS + shadcn/ui (基于 Radix UI)
- **状态管理**: Zustand (客户端) + TanStack Query (服务器状态)
- **AI 集成**: Vercel AI SDK + OpenAI/Anthropic SDK
- **可视化**: React Flow + @dnd-kit (拖拽)
- **数据处理**: Zod (验证) + @iarna/toml (TOML 解析)
- **包管理**: pnpm

## 架构设计理念

- 遵循 **Bulletproof React** 规范
- 功能模块化 (`src/features/` 目录)
- 关注点分离 (UI 组件、业务逻辑、状态管理分离)
- 完全类型安全 (TypeScript strict mode)

## 项目状态

**当前阶段**: 脚手架搭建完成，核心功能开发中

## 关键设计决策

1. **使用 React Flow 而不是自研 Canvas**: 开箱即用的缩放、平移、拖拽功能
2. **使用 Zustand 而不是 Redux**: 极简 API，轻量级 (1KB)
3. **使用 TanStack Query 处理 LLM 调用**: 自动缓存、重试、错误处理
4. **使用 localStorage 而不是数据库 (MVP 阶段)**: 零后端成本，快速验证
5. **使用 Vercel AI SDK**: 统一多个 LLM 提供商接口，内置流式支持
6. **使用 shadcn/ui**: 组件代码在项目中，完全可控和可定制

## 未来规划

- Phase 2: 添加可选的云存储 (Supabase/Firebase)
- Phase 3: 团队协作功能
