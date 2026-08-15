# X-Cartographer - 数据模型与 API 设计

**版本**: 1.0
**创建日期**: 2025-01-07
**作者**: Claude Code
**状态**: 设计阶段 (0 代码)

---

## 📋 目录

1. [数据模型设计](#数据模型设计)
2. [TypeScript 类型定义](#typescript-类型定义)
3. [LLM Prompt 设计](#llm-prompt-设计)
4. [API 接口设计](#api-接口设计)
5. [存储策略](#存储策略)
6. [数据验证规则](#数据验证规则)

---

## 🗃️ 数据模型设计

### ER 图

```
┌──────────────┐
│   Project    │
├──────────────┤
│ id           │◄────┐
│ name         │     │
│ description  │     │
│ created_at   │     │
│ updated_at   │     │
│ settings     │     │
└──────────────┘     │
                     │ 1:N
         ┌───────────┴──────────┐
         │                      │
┌────────▼────────┐    ┌───────▼──────┐
│  UserJourney    │    │   Metadata   │
├─────────────────┤    ├──────────────┤
│ id              │    │ tech_stack[] │
│ name            │    │ version      │
│ description     │    │ tags[]       │
│ persona         │    └──────────────┘
│ project_id      │
│ order           │
└─────────────────┘
         │ 1:N
         │
┌────────▼────────┐
│   UserStory     │
├─────────────────┤
│ id              │
│ title           │
│ description     │
│ priority        │
│ estimation      │
│ acceptance[]    │
│ tags[]          │
│ journey_id      │
│ order           │
└─────────────────┘
         │ 1:N
         │
┌────────▼────────┐
│      Task       │
├─────────────────┤
│ id              │
│ title           │
│ description     │
│ type            │
│ priority        │
│ estimation      │
│ status          │
│ dependencies[]  │
│ story_id        │
└─────────────────┘
```

---

## 📐 TypeScript 类型定义

### 核心类型 (`src/types/`)

#### `common.ts` - 通用类型

```typescript
/**
 * 优先级枚举
 */
export enum Priority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * 任务优先级
 */
export enum TaskPriority {
  P0 = 'P0', // Critical
  P1 = 'P1', // High
  P2 = 'P2', // Medium
  P3 = 'P3', // Low
}

/**
 * 任务类型
 */
export enum TaskType {
  USER_STORY = 'user_story',
  TECHNICAL_TASK = 'technical_task',
  BUG_FIX = 'bug_fix',
  SPIKE = 'spike',
}

/**
 * 任务状态
 */
export enum TaskStatus {
  BACKLOG = 'backlog',
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  TESTING = 'testing',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

/**
 * LLM 提供商
 */
export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
}

/**
 * 时间戳
 */
export type Timestamp = string; // ISO 8601 格式
```

#### `project.ts` - 项目类型

```typescript
import { Timestamp } from './common';
import { UserJourney } from './user-journey';

/**
 * 项目接口
 */
export interface Project {
  /** 唯一标识符 */
  id: string;

  /** 项目名称 */
  name: string;

  /** 项目描述 */
  description?: string;

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;

  /** 用户旅程列表 */
  user_journeys: UserJourney[];

  /** 项目元数据 */
  metadata: ProjectMetadata;

  /** 项目设置 */
  settings: ProjectSettings;
}

/**
 * 项目元数据
 */
export interface ProjectMetadata {
  /** 技术栈 */
  tech_stack: string[];

  /** 版本号 */
  version: string;

  /** 标签 */
  tags: string[];

  /** 总用户故事数 */
  total_stories?: number;

  /** 总任务数 */
  total_tasks?: number;

  /** 总估算工时 */
  total_estimation?: number;
}

/**
 * 项目设置
 */
export interface ProjectSettings {
  /** LLM 提供商 */
  llm_provider: LLMProvider;

  /** LLM 模型 */
  llm_model: string;

  /** 自动保存 */
  auto_save: boolean;

  /** 显示偏好 */
  display_preferences: DisplayPreferences;
}

/**
 * 显示偏好
 */
export interface DisplayPreferences {
  /** 显示优先级颜色 */
  show_priority_colors: boolean;

  /** 显示估算 */
  show_estimation: boolean;

  /** 默认视图 */
  default_view: 'map' | 'list' | 'kanban';
}
```

#### `user-journey.ts` - 用户旅程类型

```typescript
import { UserStory } from './user-story';

/**
 * 用户旅程接口
 */
export interface UserJourney {
  /** 唯一标识符，格式: UJ-XXX */
  id: string;

  /** 旅程名称 */
  name: string;

  /** 旅程描述 */
  description: string;

  /** 目标用户角色 */
  persona: string;

  /** 所属项目 ID */
  project_id: string;

  /** 包含的用户故事 */
  stories: UserStory[];

  /** 排序顺序 */
  order: number;

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;
}

/**
 * 用户旅程创建 DTO
 */
export interface CreateUserJourneyDTO {
  name: string;
  description: string;
  persona: string;
  project_id: string;
}

/**
 * 用户旅程更新 DTO
 */
export interface UpdateUserJourneyDTO {
  name?: string;
  description?: string;
  persona?: string;
  order?: number;
}
```

#### `user-story.ts` - 用户故事类型

```typescript
import { Priority, Timestamp } from './common';
import { Task } from './task';

/**
 * 用户故事接口
 */
export interface UserStory {
  /** 唯一标识符，格式: US-XXX */
  id: string;

  /** 故事标题（标准格式：作为[角色]，我想要[功能]，以便[价值]） */
  title: string;

  /** 详细描述 */
  description: string;

  /** 优先级 */
  priority: Priority;

  /** 估算工时（小时） */
  estimation: number;

  /** 验收标准列表 */
  acceptance_criteria: string[];

  /** 标签 */
  tags: string[];

  /** 所属用户旅程 ID */
  journey_id: string;

  /** 拆解的任务列表 */
  tasks?: Task[];

  /** 排序顺序 */
  order: number;

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;

  /** 可视化位置（用于故事地图） */
  position?: Position;
}

/**
 * 位置信息
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 用户故事表单
 */
export interface UserStoryForm {
  /** 用户角色 */
  role: string;

  /** 想要的功能 */
  feature: string;

  /** 目的/价值 */
  value: string;

  /** 详细描述 */
  description?: string;

  /** 优先级 */
  priority: Priority;

  /** 估算工时 */
  estimation: number;

  /** 验收标准 */
  acceptance_criteria: string[];

  /** 标签 */
  tags: string[];
}

/**
 * 用户故事创建 DTO
 */
export interface CreateUserStoryDTO {
  title: string;
  description: string;
  priority: Priority;
  estimation: number;
  acceptance_criteria: string[];
  tags: string[];
  journey_id: string;
}

/**
 * 用户故事更新 DTO
 */
export interface UpdateUserStoryDTO {
  title?: string;
  description?: string;
  priority?: Priority;
  estimation?: number;
  acceptance_criteria?: string[];
  tags?: string[];
  order?: number;
  position?: Position;
}
```

#### `task.ts` - 任务类型

```typescript
import { TaskType, TaskPriority, TaskStatus, Timestamp } from './common';

/**
 * 任务接口
 */
export interface Task {
  /** 唯一标识符，格式: TASK-XXX */
  id: string;

  /** 任务标题 */
  title: string;

  /** 任务描述 */
  description: string;

  /** 任务类型 */
  type: TaskType;

  /** 任务优先级 */
  priority: TaskPriority;

  /** 估算工时（小时） */
  estimation: number;

  /** 任务状态 */
  status: TaskStatus;

  /** 依赖的任务 ID 列表 */
  dependencies: string[];

  /** 所属用户故事 ID */
  story_id: string;

  /** 标签 */
  tags: string[];

  /** 创建时间 */
  created_at: Timestamp;

  /** 更新时间 */
  updated_at: Timestamp;

  /** 开始时间 */
  started_at?: Timestamp;

  /** 完成时间 */
  completed_at?: Timestamp;

  /** 负责人 */
  assignee?: string;
}

/**
 * 任务创建 DTO
 */
export interface CreateTaskDTO {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  estimation: number;
  dependencies?: string[];
  story_id: string;
  tags?: string[];
}

/**
 * 任务更新 DTO
 */
export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  estimation?: number;
  status?: TaskStatus;
  dependencies?: string[];
  tags?: string[];
  assignee?: string;
}
```

#### `llm.ts` - LLM 相关类型

```typescript
import { Priority } from './common';
import { UserJourney } from './user-journey';
import { UserStory } from './user-story';
import { Task } from './task';

/**
 * 需求分析请求
 */
export interface RequirementAnalysisRequest {
  /** 需求描述文本 */
  requirement_text: string;

  /** LLM 提供商 */
  provider?: LLMProvider;

  /** 模型名称 */
  model?: string;
}

/**
 * 需求分析结果
 */
export interface RequirementAnalysisResult {
  /** 识别的用户角色 */
  personas: string[];

  /** 功能点列表 */
  features: Feature[];

  /** 使用场景 */
  scenarios: Scenario[];

  /** 建议的用户旅程 */
  suggested_journeys: SuggestedJourney[];
}

/**
 * 功能点
 */
export interface Feature {
  /** 功能名称 */
  name: string;

  /** 功能描述 */
  description: string;

  /** 优先级建议 */
  suggested_priority: Priority;
}

/**
 * 使用场景
 */
export interface Scenario {
  /** 场景名称 */
  name: string;

  /** 场景描述 */
  description: string;

  /** 涉及的用户角色 */
  personas: string[];
}

/**
 * 建议的用户旅程
 */
export interface SuggestedJourney {
  /** 旅程名称 */
  name: string;

  /** 旅程描述 */
  description: string;

  /** 目标用户 */
  persona: string;

  /** 步骤列表 */
  steps: JourneyStep[];
}

/**
 * 旅程步骤
 */
export interface JourneyStep {
  /** 步骤名称 */
  name: string;

  /** 步骤描述 */
  description: string;

  /** 顺序 */
  order: number;
}

/**
 * 验收标准生成请求
 */
export interface AcceptanceCriteriaRequest {
  /** 用户故事 */
  user_story: UserStory;
}

/**
 * 验收标准生成结果
 */
export interface AcceptanceCriteriaResult {
  /** 建议的验收标准列表 */
  criteria: string[];
}

/**
 * 任务拆解请求
 */
export interface TaskDecompositionRequest {
  /** 用户故事 */
  user_story: UserStory;

  /** 技术栈信息 */
  tech_stack?: string[];
}

/**
 * 任务拆解结果
 */
export interface TaskDecompositionResult {
  /** 拆解的任务列表 */
  tasks: Task[];

  /** 总估算工时 */
  total_estimation: number;

  /** 依赖关系图 */
  dependency_graph?: DependencyNode[];
}

/**
 * 依赖节点
 */
export interface DependencyNode {
  task_id: string;
  depends_on: string[];
}
```

---

## 🤖 LLM Prompt 设计

### Prompt 模板系统

```typescript
// src/lib/llm/prompts/templates.ts

export interface PromptTemplate {
  system: string;
  user: (params: Record<string, any>) => string;
  response_format?: 'json' | 'text';
}
```

### 1. 需求分析 Prompt

```typescript
// src/lib/llm/prompts/requirement-analysis.ts

export const requirementAnalysisPrompt: PromptTemplate = {
  system: `你是一位资深的产品分析师，专门从自然语言需求中提取结构化信息。

你的任务是分析用户提供的产品需求描述，提取以下信息：
1. 目标用户角色（Personas）
2. 核心功能点（Features）
3. 使用场景（Scenarios）
4. 建议的用户旅程（User Journeys）

要求：
- 准确识别所有涉及的用户角色
- 为每个功能点建议合理的优先级（high/medium/low）
- 场景描述要具体、可操作
- 用户旅程要符合用户故事地图方法论

输出格式为 JSON。`,

  user: ({ requirement_text }) => `
请分析以下产品需求：

${requirement_text}

请以 JSON 格式返回分析结果，结构如下：

\`\`\`json
{
  "personas": ["用户角色1", "用户角色2"],
  "features": [
    {
      "name": "功能名称",
      "description": "功能描述",
      "suggested_priority": "high|medium|low"
    }
  ],
  "scenarios": [
    {
      "name": "场景名称",
      "description": "场景描述",
      "personas": ["相关用户角色"]
    }
  ],
  "suggested_journeys": [
    {
      "name": "旅程名称",
      "description": "旅程描述",
      "persona": "目标用户",
      "steps": [
        {
          "name": "步骤名称",
          "description": "步骤描述",
          "order": 1
        }
      ]
    }
  ]
}
\`\`\`
`,

  response_format: 'json',
};
```

### 2. 验收标准生成 Prompt

```typescript
// src/lib/llm/prompts/acceptance-criteria.ts

export const acceptanceCriteriaPrompt: PromptTemplate = {
  system: `你是一位资深的敏捷教练，专门编写高质量的验收标准。

你的任务是为用户故事生成符合 SMART 原则的验收标准：
- Specific（具体）
- Measurable（可衡量）
- Achievable（可实现）
- Relevant（相关）
- Time-bound（有时限）

要求：
- 每个用户故事生成 3-5 条验收标准
- 验收标准要清晰、具体、可测试
- 覆盖功能正确性、边界条件、用户体验
- 使用"Given-When-Then"或简洁的陈述句

输出格式为 JSON。`,

  user: ({ user_story }) => `
请为以下用户故事生成验收标准：

**标题**: ${user_story.title}

**描述**: ${user_story.description}

**优先级**: ${user_story.priority}

请以 JSON 格式返回验收标准：

\`\`\`json
{
  "criteria": [
    "验收标准1",
    "验收标准2",
    "验收标准3"
  ]
}
\`\`\`
`,

  response_format: 'json',
};
```

### 3. 任务拆解 Prompt

```typescript
// src/lib/llm/prompts/task-decomposition.ts

export const taskDecompositionPrompt: PromptTemplate = {
  system: `你是一位资深的技术负责人，专门将用户故事拆解为可执行的开发任务。

你的任务是将用户故事分解为 2-4 小时可完成的任务，包括：
- 任务标题和描述
- 任务类型（user_story/technical_task/bug_fix/spike）
- 优先级（P0/P1/P2/P3）
- 估算工时（小时）
- 依赖关系

要求：
- 任务粒度适中（2-4 小时）
- 清晰标识任务依赖关系
- 合理分配优先级
- 描述具体、可执行
- 考虑技术实现细节

输出格式为 JSON。`,

  user: ({ user_story, tech_stack }) => `
请将以下用户故事拆解为开发任务：

**用户故事**: ${user_story.title}

**描述**: ${user_story.description}

**验收标准**:
${user_story.acceptance_criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

**技术栈**: ${tech_stack ? tech_stack.join(', ') : 'TypeScript, Next.js, React'}

请以 JSON 格式返回任务列表：

\`\`\`json
{
  "tasks": [
    {
      "title": "任务标题",
      "description": "任务详细描述",
      "type": "user_story|technical_task|bug_fix|spike",
      "priority": "P0|P1|P2|P3",
      "estimation": 3,
      "dependencies": ["TASK-XXX"],
      "tags": ["标签1", "标签2"]
    }
  ],
  "total_estimation": 20,
  "dependency_graph": [
    {
      "task_id": "TASK-001",
      "depends_on": []
    }
  ]
}
\`\`\`

注意：
- 第一个任务的 task_id 从当前最大 ID+1 开始
- dependencies 填写依赖的 task_id
- 确保依赖关系正确，避免循环依赖
`,

  response_format: 'json',
};
```

---

## 🔌 API 接口设计

### API 路由结构

```
/api
├── /llm
│   ├── /analyze          POST  需求分析
│   ├── /generate-journey POST  生成用户旅程
│   ├── /acceptance       POST  生成验收标准
│   └── /decompose        POST  任务拆解
│
├── /projects
│   ├── /                 GET   获取项目列表
│   ├── /                 POST  创建项目
│   ├── /:id              GET   获取项目详情
│   ├── /:id              PUT   更新项目
│   └── /:id              DELETE 删除项目
│
├── /journeys
│   ├── /                 POST  创建用户旅程
│   ├── /:id              PUT   更新用户旅程
│   └── /:id              DELETE 删除用户旅程
│
├── /stories
│   ├── /                 POST  创建用户故事
│   ├── /:id              GET   获取用户故事
│   ├── /:id              PUT   更新用户故事
│   └── /:id              DELETE 删除用户故事
│
└── /tasks
    ├── /                 POST  创建任务
    ├── /:id              PUT   更新任务
    └── /:id              DELETE 删除任务
```

### API 示例

#### 1. 需求分析 API

```typescript
// POST /api/llm/analyze

// Request
{
  "requirement_text": "我需要一个在线商城...",
  "provider": "openai",
  "model": "gpt-4-turbo-preview"
}

// Response
{
  "success": true,
  "data": {
    "personas": ["普通用户", "商家", "管理员"],
    "features": [
      {
        "name": "用户注册登录",
        "description": "支持邮箱和手机号注册",
        "suggested_priority": "high"
      }
    ],
    "scenarios": [...],
    "suggested_journeys": [...]
  },
  "metadata": {
    "model_used": "gpt-4-turbo-preview",
    "tokens_used": 1234,
    "processing_time_ms": 2500
  }
}
```

#### 2. 任务拆解 API

```typescript
// POST /api/llm/decompose

// Request
{
  "user_story": {
    "id": "US-001",
    "title": "作为用户，我想要注册账号，以便使用系统功能",
    "description": "...",
    "acceptance_criteria": [...]
  },
  "tech_stack": ["TypeScript", "Next.js", "Prisma"]
}

// Response
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "TASK-001",
        "title": "设计用户数据模型",
        "description": "...",
        "type": "technical_task",
        "priority": "P0",
        "estimation": 2,
        "dependencies": [],
        "tags": ["database", "model"]
      }
    ],
    "total_estimation": 16,
    "dependency_graph": [...]
  }
}
```

---

## 💾 存储策略

### localStorage 结构

```typescript
// 存储键
const STORAGE_KEYS = {
  PROJECTS: 'x-roadmap:projects',
  CURRENT_PROJECT: 'x-roadmap:current-project',
  API_CONFIG: 'x-roadmap:api-config',
  USER_PREFERENCES: 'x-roadmap:preferences',
  DRAFTS: 'x-roadmap:drafts',
};

// 存储示例
localStorage.setItem(
  STORAGE_KEYS.PROJECTS,
  JSON.stringify({
    version: '1.0',
    projects: [
      {
        id: 'proj-xxx',
        name: 'Project Name',
        // ... 完整项目数据
      },
    ],
  })
);
```

### 加密存储（API 密钥）

```typescript
// src/lib/storage/encryption.ts

import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY!;

export const encryptData = (data: string): string => {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

export const decryptData = (encryptedData: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};
```

---

## ✅ 数据验证规则

### Zod Schemas

```typescript
// src/lib/validation/schemas.ts

import { z } from 'zod';

/**
 * 项目验证
 */
export const projectSchema = z.object({
  id: z.string().regex(/^proj-[a-z0-9]+$/),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  user_journeys: z.array(userJourneySchema),
  metadata: z.object({
    tech_stack: z.array(z.string()),
    version: z.string(),
    tags: z.array(z.string()),
  }),
  settings: z.object({
    llm_provider: z.enum(['openai', 'anthropic']),
    llm_model: z.string(),
    auto_save: z.boolean(),
  }),
});

/**
 * 用户旅程验证
 */
export const userJourneySchema = z.object({
  id: z.string().regex(/^UJ-\d{3}$/),
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  persona: z.string().min(1),
  project_id: z.string(),
  stories: z.array(userStorySchema),
  order: z.number().int().min(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * 用户故事验证
 */
export const userStorySchema = z.object({
  id: z.string().regex(/^US-\d{3}$/),
  title: z.string().min(10).max(200),
  description: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']),
  estimation: z.number().int().min(1).max(40),
  acceptance_criteria: z.array(z.string().min(1)).min(1).max(10),
  tags: z.array(z.string()),
  journey_id: z.string(),
  order: z.number().int().min(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

/**
 * 任务验证
 */
export const taskSchema = z.object({
  id: z.string().regex(/^TASK-\d{3}$/),
  title: z.string().min(5).max(150),
  description: z.string().min(1),
  type: z.enum(['user_story', 'technical_task', 'bug_fix', 'spike']),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  estimation: z.number().int().min(1).max(8),
  status: z.enum([
    'backlog',
    'todo',
    'in_progress',
    'in_review',
    'testing',
    'done',
    'cancelled',
  ]),
  dependencies: z.array(z.string()),
  story_id: z.string(),
  tags: z.array(z.string()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * 验证函数
 */
export const validateProject = (data: unknown) => {
  return projectSchema.parse(data);
};

export const validateUserStory = (data: unknown) => {
  return userStorySchema.parse(data);
};

export const validateTask = (data: unknown) => {
  return taskSchema.parse(data);
};
```

---

## 📝 TOML 格式规范

### 用户故事地图 TOML

```toml
[project]
name = "项目名称"
version = "1.0"
created_at = "2025-01-07T10:00:00Z"
description = "项目描述"
tech_stack = ["TypeScript", "Next.js"]

# 用户旅程 1
[[user_journeys]]
id = "UJ-001"
name = "用户注册"
description = "新用户注册流程"
persona = "普通用户"

[[user_journeys.stories]]
id = "US-001"
title = "作为用户，我想要注册账号，以便使用系统"
description = "..."
priority = "high"
estimation = 8
acceptance_criteria = [
  "支持邮箱注册",
  "支持手机号注册",
  "注册成功后自动登录"
]
tags = ["MVP", "核心功能"]

# 用户旅程 2
[[user_journeys]]
id = "UJ-002"
name = "用户登录"
# ...
```

### Kanban Markdown 格式

```markdown
# X-Cartographer - 开发看板

生成时间: 2025-01-07

## 📊 统计信息

- **总任务数**: 92
- **总工时**: 248 小时
- **P0 任务**: 54
- **P1 任务**: 32

## 📋 Backlog (待规划)

### TASK-087: 编写核心组件单元测试

- **类型**: technical_task
- **优先级**: P2
- **估算**: 5h
- **依赖**: 无

## 📝 To Do (待开始)

### 阶段 1: 项目初始化

#### TASK-001: 初始化 Next.js 项目脚手架

- **类型**: technical_task
- **优先级**: P0
- **估算**: 2h
- **依赖**: 无
- **标签**: setup, infrastructure

## 🚧 In Progress (进行中)

WIP 限制: 5

_(当前无任务)_

## 👀 In Review (评审中)

WIP 限制: 3

_(当前无任务)_

## ✅ Done (已完成)

_(当前无任务)_
```

---

## 🔄 数据迁移策略

### 版本管理

```typescript
// src/lib/storage/migration.ts

interface MigrationScript {
  version: string;
  migrate: (data: any) => any;
}

const migrations: MigrationScript[] = [
  {
    version: '1.0',
    migrate: (data) => data, // 初始版本
  },
  {
    version: '1.1',
    migrate: (data) => {
      // 添加新字段
      return {
        ...data,
        metadata: {
          ...data.metadata,
          total_stories: calculateTotalStories(data),
        },
      };
    },
  },
];

export const migrateData = (data: any, currentVersion: string) => {
  let migratedData = data;
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      migratedData = migration.migrate(migratedData);
    }
  }
  return migratedData;
};
```

---

**文档版本**: 1.0
**最后更新**: 2025-01-07
**维护者**: 开发团队
