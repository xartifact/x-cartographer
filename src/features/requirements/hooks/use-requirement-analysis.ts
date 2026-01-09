/**
 * 需求分析 Hook
 */

'use client';

import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useRequirementStore } from '../stores/requirement-store';
import type {
  RequirementAnalysis,
  UserPersona,
  FeaturePoint,
  UseScenario,
  JourneySuggestion,
} from '../types';

/**
 * 模拟 LLM 分析函数
 * 实际项目中这里应该调用真实的 LLM API
 */
async function mockAnalyzeRequirement(
  projectId: string,
  text: string
): Promise<RequirementAnalysis> {
  // 模拟 API 延迟
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 解析需求文本，生成模拟分析结果
  const personas: UserPersona[] = [
    {
      name: '产品用户',
      description: '使用产品的目标用户群体',
      goals: ['提高工作效率', '简化操作流程'],
      painPoints: ['功能复杂难以上手', '缺少自动化功能'],
    },
  ];

  const features: FeaturePoint[] = [
    {
      name: '用户认证',
      description: '用户注册、登录和权限管理功能',
      priority: 'high',
      complexity: 'medium',
    },
    {
      name: '数据管理',
      description: '数据的增删改查操作',
      priority: 'high',
      complexity: 'simple',
    },
    {
      name: '报表导出',
      description: '支持多种格式的数据导出',
      priority: 'medium',
      complexity: 'medium',
    },
  ];

  const scenarios: UseScenario[] = [
    {
      name: '新用户注册',
      description: '新用户完成注册流程',
      trigger: '用户访问注册页面',
      outcome: '用户成功创建账户并收到确认邮件',
      relatedPersonas: ['产品用户'],
      relatedFeatures: ['用户认证'],
    },
    {
      name: '数据查询',
      description: '用户查询特定数据',
      trigger: '用户进入数据列表页面',
      outcome: '用户看到筛选后的数据结果',
      relatedPersonas: ['产品用户'],
      relatedFeatures: ['数据管理'],
    },
  ];

  return {
    id: nanoid(),
    projectId,
    originalText: text,
    personas,
    features,
    scenarios,
    analyzedAt: new Date().toISOString(),
    confidenceScore: 0.85,
  };
}

/**
 * 模拟生成旅程建议函数
 */
async function mockGenerateJourneySuggestions(
  analysis: RequirementAnalysis
): Promise<JourneySuggestion[]> {
  // 模拟 API 延迟
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return [
    {
      id: nanoid(),
      name: '新用户注册流程',
      description: '引导新用户完成注册和个人信息设置',
      persona: '产品用户',
      stepCount: 4,
      priority: 'high',
      adopted: false,
      suggestedStories: [
        '作为新用户，我希望能够通过邮箱注册账户',
        '作为新用户，我希望能够设置个人资料',
        '作为注册用户，我希望能够通过邮箱登录',
      ],
    },
    {
      id: nanoid(),
      name: '数据管理流程',
      description: '用户进行数据的增删改查操作',
      persona: '产品用户',
      stepCount: 6,
      priority: 'high',
      adopted: false,
      suggestedStories: [
        '作为用户，我希望能够创建新的数据条目',
        '作为用户，我希望能够查看数据列表',
        '作为用户，我希望能够编辑已有数据',
        '作为用户，我希望能够删除不需要的数据',
      ],
    },
    {
      id: nanoid(),
      name: '报表导出流程',
      description: '用户导出数据报表',
      persona: '产品用户',
      stepCount: 3,
      priority: 'medium',
      adopted: false,
      suggestedStories: [
        '作为用户，我希望能够选择导出格式',
        '作为用户，我希望能够下载导出文件',
      ],
    },
  ];
}

/**
 * 需求分析 Hook
 */
export function useRequirementAnalysis() {
  const {
    inputText,
    analysis,
    journeySuggestions,
    isAnalyzing,
    isGeneratingJourneys,
    error,
    setInputText,
    setAnalysis,
    setJourneySuggestions,
    setAnalyzing,
    setGeneratingJourneys,
    setError,
    clearAnalysis,
  } = useRequirementStore();

  /**
   * 分析需求文本
   */
  const analyze = useCallback(
    async (projectId: string) => {
      if (!inputText.trim()) {
        setError('请输入需求文本');
        return;
      }

      setAnalyzing(true);
      setError(null);

      try {
        const result = await mockAnalyzeRequirement(projectId, inputText);
        setAnalysis(result);
      } catch {
        setError('需求分析失败，请稍后重试');
      }
    },
    [inputText, setAnalyzing, setError, setAnalysis]
  );

  /**
   * 生成用户旅程建议
   */
  const generateJourneys = useCallback(async () => {
    if (!analysis) {
      setError('请先完成需求分析');
      return;
    }

    setGeneratingJourneys(true);
    setError(null);

    try {
      const suggestions = await mockGenerateJourneySuggestions(analysis);
      setJourneySuggestions(suggestions);
    } catch {
      setError('旅程建议生成失败，请稍后重试');
    }
  }, [analysis, setGeneratingJourneys, setError, setJourneySuggestions]);

  /**
   * 采纳旅程建议
   */
  const adoptJourney = useCallback(
    (suggestionId: string) => {
      useRequirementStore.getState().setJourneyAdopted(suggestionId, true);
    },
    []
  );

  /**
   * 取消采纳旅程建议
   */
  const unadoptJourney = useCallback(
    (suggestionId: string) => {
      useRequirementStore.getState().setJourneyAdopted(suggestionId, false);
    },
    []
  );

  /**
   * 重置分析状态
   */
  const reset = useCallback(() => {
    clearAnalysis();
    setError(null);
  }, [clearAnalysis, setError]);

  return {
    // 状态
    inputText,
    analysis,
    journeySuggestions,
    isAnalyzing,
    isGeneratingJourneys,
    error,
    hasAnalysis: !!analysis,

    // 方法
    setInputText,
    analyze,
    generateJourneys,
    adoptJourney,
    unadoptJourney,
    reset,
  };
}