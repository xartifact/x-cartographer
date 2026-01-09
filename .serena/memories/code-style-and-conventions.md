# 代码风格和约定

## TypeScript 配置

- **严格模式**: `strict: true`
- **目标**: ES2022
- **模块系统**: ESNext
- **路径别名**: 
  - `@/*` → `./src/*`
  - `@/components/*` → `./src/components/*`
  - `@/features/*` → `./src/features/*`
  - `@/lib/*` → `./src/lib/*`
  - `@/types/*` → `./src/types/*`
  - `@/hooks/*` → `./src/hooks/*`
  - `@/utils/*` → `./src/utils/*`

## ESLint 规则

- 禁止使用 `any` 类型 (`@typescript-eslint/no-explicit-any: error`)
- 未使用变量检查 (忽略 `_` 开头的变量)
- 使用 `const` 优先 (`prefer-const: error`)
- 限制 console (只允许 `warn` 和 `error`)

## Prettier 配置

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "tabWidth": 2,
  "useTabs": false,
  "printWidth": 80
}
```

## 命名约定

### 文件命名

- **组件**: `kebab-case.tsx` (如 `story-card.tsx`)
- **工具函数**: `kebab-case.ts` (如 `format.ts`)
- **类型文件**: `kebab-case.ts` (如 `user-story.ts`)
- **Hooks**: `use-*` (如 `use-project-crud.ts`)

### 代码命名

- **组件**: PascalCase (如 `StoryCard`)
- **函数/变量**: camelCase (如 `getUserStory`)
- **类型/接口**: PascalCase (如 `UserStory`)
- **常量**: UPPER_SNAKE_CASE (如 `STORAGE_KEYS`)
- **枚举**: PascalCase (如 `Priority`)

## 目录结构约定

### Bulletproof React 规范

```
src/
├── app/              # Next.js App Router (路由和页面)
├── components/       # 共享 UI 组件
│   ├── ui/          # shadcn/ui 基础组件
│   ├── layouts/     # 布局组件
│   ├── common/      # 通用业务组件
│   └── providers/   # Context Providers
├── features/        # 功能模块 (垂直切分)
│   └── <feature>/
│       ├── components/  # 功能特定组件
│       ├── api/         # API 调用
│       ├── hooks/       # 功能特定 Hooks
│       ├── stores/      # Zustand 状态
│       ├── types/       # 功能特定类型
│       └── index.ts     # 导出入口
├── lib/             # 工具库 (框架无关)
│   ├── llm/         # LLM 集成
│   ├── toml/        # TOML 解析
│   ├── storage/     # 数据持久化
│   └── validation/  # 数据验证
├── types/           # 全局类型定义
├── hooks/           # 全局共享 Hooks
├── utils/           # 工具函数
└── constants/       # 常量定义
```

## 组件开发规范

### 组件结构

```typescript
// 1. 导入 (外部库优先，然后内部模块)
import React from 'react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/features/projects/stores/project-store';

// 2. 类型定义
interface MyComponentProps {
  // ...
}

// 3. 组件定义
export function MyComponent({ prop1 }: MyComponentProps) {
  // 4. Hooks (按顺序: useState, useStore, 自定义 hooks)
  const [state, setState] = useState();
  const projects = useProjectStore((state) => state.projects);
  
  // 5. 事件处理函数
  const handleClick = () => {
    // ...
  };
  
  // 6. 副作用
  useEffect(() => {
    // ...
  }, []);
  
  // 7. 渲染
  return (
    <div>...</div>
  );
}
```

### 组件最佳实践

- 使用函数组件 + Hooks
- 避免过度抽象 (3 处相似代码才考虑抽象)
- 组件职责单一 (SRP)
- Props 接口明确命名
- 使用 TypeScript 类型推导

## 状态管理规范

### Zustand Store

```typescript
// stores/project-store.ts
interface ProjectStore {
  // 状态
  projects: Project[];
  currentProject: Project | null;
  
  // 操作
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project) => void;
  
  // Action
  createProject: (data: CreateProjectDTO) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // ...
}));
```

### 使用原则

- 细粒度订阅: `useProjectStore((state) => state.projects)` 而不是 `useProjectStore()`
- 服务器状态使用 TanStack Query
- 客户端 UI 状态使用 Zustand

## 数据验证

- 使用 Zod Schema 验证所有外部输入
- LLM 响应必须验证
- 用户输入必须验证

## 代码注释

- **不写**显而易见的注释
- 写 **为什么** 而不是 **是什么**
- 复杂业务逻辑需要注释
- API 函数需要 JSDoc

## Git 提交规范

使用 Conventional Commits:

```
feat: 添加用户故事管理功能
fix: 修复需求分析 API 错误
refactor: 重构状态管理逻辑
docs: 更新 README
chore: 更新依赖
```

## 测试策略

- **MVP 阶段**: 不写单元测试
- **Phase 2**: 添加集成测试
- **Phase 3**: 完善单元测试覆盖
