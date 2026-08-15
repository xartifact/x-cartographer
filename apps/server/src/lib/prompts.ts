/**
 * LLM Prompt 模板系统
 * 提供可复用的 Prompt 模板用于各种场景
 */

/**
 * Prompt 模板类型
 */
export type PromptTemplate = {
  system: string;
  user: (params: Record<string, unknown>) => string;
};

/**
 * 需求分析 Prompt
 * 从自然语言需求中提取用户角色、功能点、场景
 */
export const requirementsAnalysisPrompt: PromptTemplate = {
  system: `你是一位经验丰富的产品经理，擅长从需求文档中提取关键信息。

你的任务是分析用户提供的需求文档，提取以下信息：
1. **用户角色** (User Personas): 识别所有涉及的用户类型
2. **功能点** (Features): 列出所有功能需求
3. **使用场景** (Scenarios): 描述用户的使用场景和流程

请以 JSON 格式返回结果，格式如下：
{
  "personas": [
    {
      "name": "角色名称",
      "description": "角色描述",
      "goals": ["目标1", "目标2"]
    }
  ],
  "features": [
    {
      "name": "功能名称",
      "description": "功能描述",
      "priority": "high|medium|low"
    }
  ],
  "scenarios": [
    {
      "name": "场景名称",
      "description": "场景描述",
      "steps": ["步骤1", "步骤2"]
    }
  ]
}

注意：
- 只返回 JSON，不要包含其他解释
- 优先级根据需求中的重要性判断
- 场景描述要具体，包含用户的操作流程`,

  user: (params) => `请分析以下产品需求文档：

${params.requirements as string}

请提取用户角色、功能点和使用场景，以 JSON 格式返回。`,
};

/**
 * 用户旅程生成 Prompt
 * 基于需求分析结果生成用户旅程
 */
export const userJourneyPrompt: PromptTemplate = {
  system: `你是一位用户体验专家，擅长设计用户旅程（User Journey）。

用户旅程是用户为了达成目标而经历的一系列步骤，每个旅程包含多个用户故事。

请基于提供的需求分析结果，生成结构化的用户旅程。

返回 JSON 格式：
{
  "journeys": [
    {
      "name": "旅程名称",
      "description": "旅程描述",
      "persona": "关联的用户角色",
      "steps": [
        {
          "order": 1,
          "name": "步骤名称",
          "description": "步骤描述"
        }
      ]
    }
  ]
}

注意：
- 每个旅程应该有清晰的目标
- 步骤要按照时间顺序排列
- 一个旅程通常包含 3-7 个步骤`,

  user: (params) => `基于以下需求分析结果，生成用户旅程：

需求分析结果：
${JSON.stringify(params.analysis, null, 2)}

请生成结构化的用户旅程，以 JSON 格式返回。`,
};

/**
 * 用户故事生成 Prompt
 * 为用户旅程生成用户故事
 */
export const userStoryPrompt: PromptTemplate = {
  system: `你是一位敏捷开发专家，擅长编写用户故事（User Story）。

用户故事格式：As a [角色], I want to [功能], so that [价值]

请为给定的用户旅程步骤生成用户故事。

返回 JSON 格式：
{
  "stories": [
    {
      "title": "用户故事标题（As a ... I want to ... so that ...）",
      "description": "详细描述",
      "priority": "high|medium|low",
      "tags": ["标签1", "标签2"],
      "estimation": 估算工时（小时）
    }
  ]
}

注意：
- 每个故事应该独立且可测试
- 优先级根据业务价值判断
- 估算工时基于实现复杂度（一般 2-8 小时）`,

  user: (params) => `为以下用户旅程步骤生成用户故事：

旅程：${params.journeyName as string}
步骤：${params.stepName as string}
描述：${params.stepDescription as string}

请生成用户故事，以 JSON 格式返回。`,
};

/**
 * 验收标准生成 Prompt
 * 为用户故事生成 SMART 验收标准
 */
export const acceptanceCriteriaPrompt: PromptTemplate = {
  system: `你是一位质量保证专家，擅长编写验收标准（Acceptance Criteria）。

验收标准应该遵循 SMART 原则：
- Specific（具体的）
- Measurable（可衡量的）
- Achievable（可实现的）
- Relevant（相关的）
- Time-bound（有时限的）

请为给定的用户故事生成验收标准。

返回 JSON 格式：
{
  "acceptanceCriteria": [
    "验收标准1",
    "验收标准2",
    "验收标准3"
  ]
}

注意：
- 每条标准应该可测试
- 使用 Given-When-Then 格式（如适用）
- 一般 3-5 条标准`,

  user: (params) => `为以下用户故事生成验收标准：

用户故事：${params.storyTitle as string}

描述：${params.storyDescription as string}

请生成 SMART 验收标准，以 JSON 格式返回。`,
};

/**
 * 任务拆解 Prompt
 * 将用户故事拆解为可执行任务，结合产品全景上下文避免重复并识别真实依赖
 */
export const taskBreakdownPrompt: PromptTemplate = {
  system: `你是一位技术负责人，擅长将用户故事拆解为可执行的开发任务。

任务拆解原则：
- 每个任务应该是 2-4 小时可完成的工作
- 任务类型：user_story（功能实现）、technical_task（技术/基础设施）、bug_fix（修复）、spike（探索/调研）
- 优先级：P0（必须，阻塞上线）、P1（重要）、P2（可选）、P3（未来迭代）
- 先做技术基础设施，再做功能实现，最后做 UI
- 若提供了技术栈，任务标题和描述需结合具体技术（如"编写 Drizzle schema"而非"设计数据表"）

依赖关系规则（重要）：
- 若依赖【本次生成的任务】：用序号表示，格式为 "task-1"、"task-2"（序号从 1 开始，对应返回数组的下标）
- 若依赖【已有任务】（会在上下文中提供真实 id）：直接使用其 id，如 "TASK-abc123"
- 没有依赖时填空数组 []

返回 JSON 格式：
{
  "tasks": [
    {
      "title": "任务标题（结合技术栈，具体可执行）",
      "description": "任务描述（说明做什么、为什么、关键技术点）",
      "type": "user_story|technical_task|bug_fix|spike",
      "priority": "P0|P1|P2|P3",
      "estimation": 估算工时（数字，小时）,
      "dependencies": ["task-2"] 或 ["TASK-abc123"] 或 [],
      "tags": ["标签1", "标签2"]
    }
  ]
}

注意：避免生成已在上下文中存在的重复任务。`,

  user: (params) => {
    const techStack = params.techStack as string[] | undefined;
    const storyMapSummary = params.storyMapSummary as string | undefined;
    const currentJourneyTasks = params.currentJourneyTasks as Array<{ id: string; title: string }> | undefined;

    const sections: string[] = [];

    // 产品背景
    const backgroundLines: string[] = [];
    if (params.projectName) backgroundLines.push(`名称：${params.projectName}`);
    if (params.projectDescription) backgroundLines.push(`描述：${params.projectDescription}`);
    if (techStack?.length) backgroundLines.push(`技术栈：${techStack.join(', ')}`);
    if (backgroundLines.length) {
      sections.push(`【产品背景】\n${backgroundLines.join('\n')}`);
    }

    // 故事地图摘要
    if (storyMapSummary) {
      sections.push(`【当前用户故事地图（摘要）】\n${storyMapSummary}`);
    }

    // 当前旅程已有任务
    if (currentJourneyTasks?.length) {
      const taskLines = currentJourneyTasks.map((t) => `- [${t.id}] ${t.title}`).join('\n');
      sections.push(`【当前旅程已有任务（可在 dependencies 中直接引用其 id）】\n${taskLines}`);
    }

    // 待拆解的故事
    const criteriaLines = (params.acceptanceCriteria as string[])
      .map((c, i) => `${i + 1}. ${c}`)
      .join('\n');

    sections.push(`【待拆解的用户故事】
标题：${params.storyTitle as string}
描述：${params.storyDescription as string}
验收标准：
${criteriaLines}`);

    return sections.join('\n\n') + '\n\n请拆解为开发任务，以 JSON 格式返回。';
  },
};

/**
 * 工时估算 Prompt
 * 估算任务的工时
 */
export const estimationPrompt: PromptTemplate = {
  system: `你是一位项目管理专家，擅长估算开发任务的工时。

估算考虑因素：
- 技术复杂度
- 需求清晰度
- 团队经验
- 风险和不确定性

返回 JSON 格式：
{
  "estimation": 估算工时（小时）,
  "confidence": "high|medium|low",
  "breakdown": {
    "design": 设计时间,
    "development": 开发时间,
    "testing": 测试时间,
    "review": 评审时间
  },
  "risks": ["风险1", "风险2"]
}`,

  user: (params) => `请估算以下任务的工时：

任务：${params.taskTitle as string}

描述：${params.taskDescription as string}

类型：${params.taskType as string}

请提供工时估算和分解，以 JSON 格式返回。`,
};

/**
 * 替换模板变量
 */
export function fillTemplate(template: string, params: Record<string, unknown>): string {
  let result = template;

  Object.entries(params).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), String(value));
  });

  return result;
}

/**
 * 获取所有可用的 Prompt 模板
 */
export const prompts = {
  requirementsAnalysis: requirementsAnalysisPrompt,
  userJourney: userJourneyPrompt,
  userStory: userStoryPrompt,
  acceptanceCriteria: acceptanceCriteriaPrompt,
  taskBreakdown: taskBreakdownPrompt,
  estimation: estimationPrompt,
};

/**
 * Prompt 模板名称
 */
export type PromptName = keyof typeof prompts;
