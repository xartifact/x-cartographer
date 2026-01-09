/**
 * 需求分析相关类型定义
 */

/**
 * 用户角色
 */
export interface UserPersona {
  /** 角色名称 */
  name: string;

  /** 角色描述 */
  description: string;

  /** 目标和动机 */
  goals: string[];

  /** 痛点和挑战 */
  painPoints: string[];
}

/**
 * 功能点
 */
export interface FeaturePoint {
  /** 功能名称 */
  name: string;

  /** 功能描述 */
  description: string;

  /** 优先级 */
  priority: 'high' | 'medium' | 'low';

  /** 复杂度评估 */
  complexity: 'simple' | 'medium' | 'complex';
}

/**
 * 使用场景
 */
export interface UseScenario {
  /** 场景名称 */
  name: string;

  /** 场景描述 */
  description: string;

  /** 触发条件 */
  trigger: string;

  /** 预期结果 */
  outcome: string;

  /** 关联角色 */
  relatedPersonas: string[];

  /** 关联功能 */
  relatedFeatures: string[];
}

/**
 * 需求分析结果
 */
export interface RequirementAnalysis {
  /** 唯一标识 */
  id: string;

  /** 项目 ID */
  projectId: string;

  /** 原始需求文本 */
  originalText: string;

  /** 提取的用户角色 */
  personas: UserPersona[];

  /** 识别的功能点 */
  features: FeaturePoint[];

  /** 分析的使用场景 */
  scenarios: UseScenario[];

  /** 分析时间 */
  analyzedAt: string;

  /** 置信度分数 (0-1) */
  confidenceScore: number;
}

/**
 * 用户旅程建议
 */
export interface JourneySuggestion {
  /** 唯一标识 */
  id: string;

  /** 旅程名称 */
  name: string;

  /** 旅程描述 */
  description: string;

  /** 目标用户角色 */
  persona: string;

  /** 预估步骤数 */
  stepCount: number;

  /** 优先级 */
  priority: 'high' | 'medium' | 'low';

  /** 是否已被采纳 */
  adopted: boolean;

  /** 包含的用户故事标题 */
  suggestedStories: string[];
}

/**
 * 需求分析状态
 */
export interface RequirementState {
  /** 当前输入的需求文本 */
  inputText: string;

  /** 分析结果 */
  analysis: RequirementAnalysis | null;

  /** 旅程建议 */
  journeySuggestions: JourneySuggestion[];

  /** 是否正在分析 */
  isAnalyzing: boolean;

  /** 是否正在生成旅程 */
  isGeneratingJourneys: boolean;

  /** 错误信息 */
  error: string | null;
}

/**
 * 需求分析请求 DTO
 */
export interface AnalyzeRequirementDTO {
  /** 项目 ID */
  projectId: string;

  /** 需求文本 */
  requirementText: string;
}

/**
 * 生成旅程请求 DTO
 */
export interface GenerateJourneysDTO {
  /** 项目 ID */
  projectId: string;

  /** 分析结果 ID */
  analysisId: string;
}

/**
 * 旅程建议请求 DTO
 */
export interface JourneySuggestionDTO {
  /** 旅程名称 */
  name: string;

  /** 旅程描述 */
  description: string;

  /** 目标用户角色 */
  persona: string;

  /** 预估故事数 */
  storyCount: number;
}