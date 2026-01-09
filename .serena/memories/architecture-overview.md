# 架构概览

## 技术栈分层

```
┌─────────────────────────────────────────────────────────────┐
│                      用户界面层 (UI Layer)                    │
│  Next.js App Router + React 18 + Tailwind CSS + shadcn/ui  │
├─────────────────────────────────────────────────────────────┤
│                    状态管理层 (State Layer)                   │
│  Zustand (全局状态) + TanStack Query (服务器状态)           │
├─────────────────────────────────────────────────────────────┤
│                    业务逻辑层 (Logic Layer)                   │
│  Features: Requirements | UserJourneys | UserStories       │
│            | StoryMap | Tasks | Projects | Settings         │
├─────────────────────────────────────────────────────────────┤
│                    服务层 (Service Layer)                     │
│  LLM Client | TOML Parser | Storage Manager | Markdown      │
├─────────────────────────────────────────────────────────────┤
│                    数据层 (Data Layer)                        │
│  localStorage (MVP) + TOML Files (导入/导出)                 │
└─────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
   OpenAI API          Anthropic API         Future LLMs
```

## 核心数据流

### 1. 需求分析流程

```
用户输入需求
    ↓
RequirementInput 组件
    ↓
useRequirementAnalysis Hook
    ↓
LLM Client (lib/llm/)
    ↓
OpenAI/Anthropic API
    ↓
Zod Schema 验证
    ↓
RequirementStore (Zustand)
    ↓
AnalysisResult 组件展示
    ↓
保存到 localStorage
```

### 2. 故事地图可视化流程

```
加载项目数据
    ↓
StoryStore (Zustand)
    ↓
布局算法 (layout-algorithm.ts)
    ↓
React Flow 渲染
    ↓
用户交互 (缩放/平移/拖拽)
    ↓
CanvasStore 更新视图状态
    ↓
DetailPanel 显示详情
```

### 3. 任务拆解流程

```
选择用户故事
    ↓
useTaskDecomposition Hook
    ↓
LLM Client 调用
    ↓
任务拆解 Prompt
    ↓
LLM 返回任务列表
    ↓
TaskStore 保存
    ↓
TaskList 组件渲染
```

## 模块划分

### 功能模块 (`src/features/`)

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| **requirements** | 需求输入和分析 | `requirement-input.tsx`, `use-requirement-analysis.ts` |
| **user-journeys** | 用户旅程管理 | `journey-list.tsx`, `journey-editor.tsx` |
| **user-stories** | 用户故事 CRUD | `story-form.tsx`, `story-card.tsx` |
| **story-map** | 可视化地图 | `story-map-canvas.tsx` (React Flow) |
| **tasks** | 任务拆解 | `task-list.tsx`, `use-task-decomposition.ts` |
| **export** | 数据导出 | `export-dialog.tsx` |
| **projects** | 项目管理 | `project-list.tsx`, `project-form.tsx` |
| **settings** | 系统配置 | `api-config-form.tsx` |

### 工具库 (`src/lib/`)

| 子目录 | 职责 |
|--------|------|
| **llm/** | LLM 客户端和 Prompt 模板 |
| **toml/** | TOML 解析和序列化 |
| **storage/** | localStorage 和加密 |
| **markdown/** | Markdown 生成 |
| **validation/** | Zod Schema 验证 |

## 关键技术决策

### 为什么选择 React Flow?

- ✅ 开箱即用的缩放、平移、拖拽
- ✅ 自定义节点和边的能力
- ✅ 性能优化 (虚拟化渲染)
- ✅ TypeScript 支持完善

### 为什么使用 Zustand?

- ✅ 极简 API，学习曲线平缓
- ✅ 无需 Provider 包裹
- ✅ 包体积小 (1KB vs Redux 45KB)
- ✅ 与 React 18 并发特性兼容

### 为什么使用 TanStack Query?

- ✅ 自动缓存，减少 API 调用成本
- ✅ 请求去重
- ✅ 自动重试和错误处理
- ✅ SSR 友好

### 为什么使用 localStorage (MVP)?

- ✅ 零后端成本
- ✅ 快速 MVP 验证
- ✅ 用户数据完全本地化 (隐私)
- ✅ 离线可用

### 为什么选择 shadcn/ui?

- ✅ 基于 Radix UI (无障碍性) + Tailwind CSS
- ✅ 组件代码在项目中，完全可控
- ✅ 不是 npm 依赖，避免版本锁定
- ✅ 优秀的 TypeScript 支持
- ✅ 丰富的组件库 (40+ 组件)

## 性能优化策略

1. **代码分割**: 路由级分割 (Next.js 自动) + 组件级懒加载
2. **虚拟化渲染**: React Flow 自带 + 大列表使用 `@tanstack/react-virtual`
3. **状态优化**: Zustand 细粒度订阅
4. **图片优化**: Next.js Image 组件
5. **Bundle 优化**: Webpack splitChunks 配置

## 安全考虑

1. **API 密钥保护**: 使用 `crypto-js` 加密存储
2. **环境变量**: 敏感信息使用 `.env.local`
3. **CSP 配置**: Next.js security headers
4. **数据验证**: 所有外部输入使用 Zod 验证

## 数据模型关系

```
Project
  ├─ UserJourney[]
  │   └─ UserStory[]
  │       └─ Task[]
  │
  ├─ metadata (tech_stack, version, tags)
  └─ settings (llm_provider, preferences)
```
