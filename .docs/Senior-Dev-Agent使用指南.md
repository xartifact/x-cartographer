# Senior-Dev Agent 使用指南

**创建日期**: 2025-01-07
**Agent 版本**: 1.0.0

---

## 🎯 Agent 概述

**senior-dev** 是一个专为 X-Cartographer 项目设计的高级研发&架构师 AI Agent。它能够自主执行开发任务，遵循项目架构规范，生成高质量的 TypeScript/React 代码。

### 核心能力

- ✅ 读取并理解开发任务列表（.user-stories/tasks-x-cartographer-mvp.toml）
- ✅ 遵循 Bulletproof React 架构模式
- ✅ 实现功能模块（components, hooks, stores, api）
- ✅ 使用 shadcn/ui 组件库
- ✅ 确保 TypeScript 类型安全
- ✅ 运行类型检查验证代码质量

---

## 📦 Agent 位置

```
.claude/plugins/x-cartographer/
├── agents/
│   └── senior-dev.md          # Agent 定义文件
├── plugin.json                # 插件配置
└── README.md                  # 插件说明
```

---

## 🚀 如何使用

### 方法 1: 直接调用（推荐）

```bash
# 在 Claude Code 中直接提到需要开发功能
"开始实现项目管理功能模块"

# Claude 会自动识别并使用 senior-dev agent
```

### 方法 2: 显式调用

```bash
# 使用 @ 符号显式调用 agent
@agent-senior-dev 实现需求分析功能

# 或者使用完整名称
@agent-x-cartographer:senior-dev 按照架构规范实现用户故事管理
```

### 方法 3: 任务导向调用

```bash
# 指定具体任务 ID
"实现 TASK-006 到 TASK-010：数据模型设计"

# Agent 会读取任务详情并实现
```

---

## 💡 使用场景

### 场景 1: 实现完整功能模块

**用户输入**:
```
按照 Bulletproof React 规范实现需求分析功能
```

**Agent 行为**:
1. 读取 .user-stories/tasks-x-cartographer-mvp.toml 中的相关任务
2. 理解需求和验收标准
3. 创建功能模块目录结构:
   ```
   src/features/requirements/
   ├── components/
   ├── api/
   ├── hooks/
   ├── stores/
   ├── types/
   └── index.ts
   ```
4. 实现所有必要的组件和逻辑
5. 运行 `pnpm type-check` 验证
6. 输出实现报告

### 场景 2: 实现核心工具库

**用户输入**:
```
实现 LLM API 客户端封装
```

**Agent 行为**:
1. 读取架构设计文档中的 LLM 集成规范
2. 在 `src/lib/llm/` 创建必要文件:
   ```
   src/lib/llm/
   ├── client.ts              # 统一客户端接口
   ├── providers/
   │   ├── openai.ts
   │   ├── anthropic.ts
   │   └── types.ts
   ├── prompts/
   │   └── templates.ts
   └── index.ts
   ```
3. 使用 Vercel AI SDK 实现
4. 确保类型安全
5. 导出公共 API

### 场景 3: 执行特定开发任务

**用户输入**:
```
实现 TASK-011: 创建 LLM API 客户端封装
```

**Agent 行为**:
1. 从任务列表读取 TASK-011 详情
2. 检查任务依赖（TASK-002）
3. 理解验收标准
4. 实现代码
5. 标记任务为完成

### 场景 4: 创建 UI 组件

**用户输入**:
```
创建用户故事卡片组件
```

**Agent 行为**:
1. 在 `src/features/user-stories/components/` 创建 `story-card.tsx`
2. 使用 shadcn/ui 的 Card 组件
3. 应用 Tailwind CSS 样式
4. 实现 TypeScript 接口
5. 导出组件

---

## 📋 Agent 工作流程

### 1. 任务选择和分析

```
┌─────────────────────────────────────┐
│ 读取任务列表                         │
│ .user-stories/tasks-*.toml          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 筛选任务                             │
│ - Priority: P0/P1                   │
│ - Status: todo                      │
│ - Dependencies: 已完成               │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 选择 1-3 个相关任务                  │
└─────────────────────────────────────┘
```

### 2. 需求理解

```
┌─────────────────────────────────────┐
│ 读取任务描述和验收标准                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 查阅架构文档                         │
│ - 架构设计-项目脚手架与技术栈.md      │
│ - 数据模型与API设计.md               │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 检查现有类型和工具                    │
│ - src/types/                        │
│ - src/utils/                        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 规划实现方案                         │
└─────────────────────────────────────┘
```

### 3. 代码实现

```
┌─────────────────────────────────────┐
│ 创建/修改文件                        │
│ - 遵循 Bulletproof React 结构        │
│ - 使用 TypeScript 严格模式           │
│ - 应用 shadcn/ui 组件                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 实现状态管理                         │
│ - Zustand stores                    │
│ - TanStack Query hooks              │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 添加类型定义                         │
│ - Props interfaces                  │
│ - Return types                      │
│ - Custom types                      │
└─────────────────────────────────────┘
```

### 4. 质量验证

```
┌─────────────────────────────────────┐
│ pnpm type-check                     │
│ - 检查 TypeScript 类型               │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 验证导入路径                         │
│ - 检查 @ 别名                        │
│ - 确认文件存在                       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ ESLint 检查（如有错误则修复）         │
└─────────────────────────────────────┘
```

### 5. 输出报告

```
┌─────────────────────────────────────┐
│ 实现总结                             │
│ - 完成的任务                         │
│ - 创建的文件                         │
│ - 关键代码片段                       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 验证结果                             │
│ - ✅ 类型检查通过                    │
│ - ✅ ESLint 无错误                   │
│ - ✅ 符合架构规范                    │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 下一步建议                           │
│ - 推荐后续任务                       │
│ - 潜在改进点                         │
└─────────────────────────────────────┘
```

---

## 🎨 输出格式

Agent 完成任务后会输出以下格式的报告：

```markdown
## 实现任务: TASK-XXX: 任务标题

### 选择理由
- 优先级: P0
- 依赖状态: 无阻塞依赖
- 相关功能: [功能模块名称]

### 实现方案
- 技术方案: [描述]
- 关键决策: [说明]
- 文件结构: [列表]

### 代码实现

#### 1. [组件/模块名称]

```typescript
// 代码片段
```

**说明**: [代码解释]

#### 2. [下一个组件/模块]

```typescript
// 代码片段
```

**说明**: [代码解释]

### 文件清单
- ✅ Created: src/features/xxx/components/xxx.tsx
- ✅ Modified: src/features/xxx/index.ts
- 📝 Notes: [重要说明]

### 验证结果
- ✅ TypeScript 类型检查通过
- ✅ ESLint 无错误
- ✅ 符合架构规范

### 下一步建议
1. 实现 TASK-YYY: [任务名称]
2. 优化 [某个方面]
3. 考虑 [改进建议]
```

---

## ⚙️ 技术规范

### TypeScript 规范

```typescript
// ✅ 正确: 明确的类型定义
interface UserStoryCardProps {
  story: UserStory;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export function UserStoryCard({ story, onEdit, onDelete }: UserStoryCardProps) {
  // 实现
}

// ❌ 错误: 使用 any
function handleData(data: any) {
  // 不允许
}

// ❌ 错误: 缺少类型注解
function processStory(story) {
  // 不允许
}
```

### 组件规范

```typescript
// ✅ 标准组件结构
'use client'; // 仅在需要时添加

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { UserStory } from '@/types';

interface Props {
  // Props 定义
}

export function ComponentName({ prop1, prop2 }: Props) {
  // Hooks
  const [state, setState] = useState();

  // Event handlers
  const handleClick = () => {
    // 实现
  };

  // Render
  return (
    <Card>
      {/* UI */}
    </Card>
  );
}
```

### 目录规范

```
✅ 功能模块结构
src/features/feature-name/
├── components/          # UI 组件
│   ├── component-a.tsx
│   ├── component-b.tsx
│   └── index.ts        # 导出所有组件
├── api/                # API 调用
│   ├── fetch-data.ts
│   └── types.ts
├── hooks/              # 自定义 Hooks
│   ├── use-feature.ts
│   └── index.ts
├── stores/             # Zustand 状态
│   └── feature-store.ts
├── types/              # 本地类型
│   └── index.ts
└── index.ts            # 模块公共导出
```

---

## 🚫 限制和约束

### Agent 不会做的事情

- ❌ 编写测试文件（.test.ts, .spec.ts）
- ❌ 修改根配置文件（未经许可）
- ❌ 更改 src/types/ 中的核心类型（未经确认）
- ❌ 安装新依赖（未说明理由）
- ❌ 实现不在任务列表中的功能（未经批准）

### Agent 会做的事情

- ✅ 遵循现有模式和约定
- ✅ 复用已有组件和工具
- ✅ 对模糊需求寻求澄清
- ✅ 建议架构改进（但按现状实现）
- ✅ 运行类型检查验证代码

---

## 📚 相关文档

在调用 Agent 前，建议先了解以下文档：

1. **任务列表**: `.user-stories/tasks-x-cartographer-mvp.toml`
   - 92 个开发任务
   - 按优先级组织（P0/P1/P2）
   - 包含验收标准

2. **架构设计**: `.docs/架构设计-项目脚手架与技术栈.md`
   - 完整的技术栈说明
   - Bulletproof React 规范
   - 目录结构和职责

3. **数据模型**: `.docs/数据模型与API设计.md`
   - TypeScript 类型定义
   - LLM Prompt 设计
   - API 接口规范

4. **产品分析**: `.user-stories/x-cartographer-mvp-分析报告.md`
   - 用户故事地图
   - 功能需求
   - 开发排期

---

## 🎯 最佳实践

### 1. 明确任务范围

```bash
# ❌ 不清楚
"帮我做点开发"

# ✅ 清楚
"实现 TASK-018 到 TASK-021：需求输入界面的 4 个任务"
```

### 2. 指定功能模块

```bash
# ❌ 不清楚
"做用户故事"

# ✅ 清楚
"按照 Bulletproof React 规范实现用户故事管理功能，包括 CRUD 操作和状态管理"
```

### 3. 提供上下文

```bash
# ❌ 缺少上下文
"写个组件"

# ✅ 提供上下文
"创建用户故事卡片组件，使用 shadcn/ui 的 Card，展示故事标题、描述、优先级和标签"
```

### 4. 分批实现

```bash
# ❌ 范围过大
"实现所有功能"

# ✅ 分批实现
"先实现项目管理模块（TASK-070 到 TASK-077），然后再做其他功能"
```

---

## 🐛 常见问题

### Q: Agent 没有被触发？

**A**: 检查以下几点：
1. 确保 `.claude/plugins/x-cartographer/` 目录存在
2. 确认 `plugin.json` 配置正确
3. 重启 Claude Code（如果刚创建插件）
4. 使用明确的触发短语（如"实现功能"、"开发模块"）

### Q: Agent 实现的代码不符合预期？

**A**: 提供更详细的需求：
1. 明确指定任务 ID
2. 说明特定的技术要求
3. 引用架构文档中的相关章节
4. 提供示例代码或参考

### Q: 如何查看 Agent 可以访问的文档？

**A**: Agent 可以读取以下文档：
- `.user-stories/tasks-x-cartographer-mvp.toml`
- `.docs/架构设计-项目脚手架与技术栈.md`
- `.docs/数据模型与API设计.md`
- `.user-stories/x-cartographer-mvp-分析报告.md`
- 以及所有 `src/` 目录下的代码文件

### Q: Agent 会修改已有代码吗？

**A**: Agent 会：
- ✅ 创建新文件
- ✅ 添加导出到 index.ts
- ✅ 修改文件以实现功能（如果需要）
- ❌ 不会修改核心配置文件
- ❌ 不会更改已建立的类型定义（未经确认）

---

## 📊 性能和效率

### 预期开发速度

- **简单任务** (2-3h): 10-15 分钟
- **中等任务** (5-8h): 20-30 分钟
- **复杂任务** (13h+): 40-60 分钟
- **完整模块**: 1-2 小时

### 代码质量指标

- ✅ TypeScript 类型覆盖率: 100%
- ✅ ESLint 合规性: 100%
- ✅ 架构规范符合度: 100%
- ✅ 组件复用率: 高
- ✅ 代码可维护性: 优秀

---

## 🔄 更新和维护

### Agent 更新流程

1. 修改 `.claude/plugins/x-cartographer/agents/senior-dev.md`
2. 更新版本号和更新日志
3. 重启 Claude Code 使更改生效

### 反馈和改进

如发现 Agent 行为需要调整：
1. 记录具体问题和期望行为
2. 修改 Agent 的系统提示
3. 测试修改后的效果
4. 更新本文档

---

## ✅ 快速开始

现在就可以开始使用 senior-dev agent：

```bash
# 1. 简单调用
"开始实现第一个功能模块"

# 2. 或者查看任务列表后指定
"查看任务列表，然后实现优先级最高的 3 个任务"

# 3. 或者明确指定
"实现 TASK-001 到 TASK-005：项目初始化和基础设施任务"
```

Agent 会自动：
- 📖 读取任务详情
- 🎯 理解需求和验收标准
- 💻 实现高质量代码
- ✅ 验证类型和规范
- 📝 输出详细报告

开始开发吧！🚀

---

**文档版本**: 1.0.0
**最后更新**: 2025-01-07
