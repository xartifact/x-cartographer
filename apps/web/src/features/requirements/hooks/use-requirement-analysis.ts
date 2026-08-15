/**
 * 需求分析 Hook
 *
 * 调用 Gateway REST API（/api/llm/*）分析需求文本。
 * API Key 存储在服务端，客户端只传递 provider / model 配置。
 */

'use client';

import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useRequirementStore } from '../stores/requirement-store';
import { useProjects } from '@/lib/api/hooks';
import { api } from '@/lib/api/client';
import type {
  RequirementAnalysis,
  UserPersona,
  FeaturePoint,
  UseScenario,
  JourneySuggestion,
} from '../types';
import type { Project } from '@xpm/shared';
import { LLMProvider } from '@xpm/shared';

// ─── 辅助：获取项目 LLM provider ─────────────────────────────────────────────

function getLLMProvider(projectId: string, projects: Project[]): LLMProvider {
  const project = projects.find((p) => p.id === projectId);
  return project?.settings?.llm_provider ?? LLMProvider.OPENAI;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

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

  const { data: projects = [] } = useProjects();

  /**
   * 分析需求文本（调用 Gateway REST API）
   */
  const analyze = useCallback(
    async (projectId: string) => {
      if (!inputText.trim()) {
        setError('请输入需求文本');
        return;
      }

      const provider = getLLMProvider(projectId, projects);

      setAnalyzing(true);
      setError(null);

      try {
        const res = await api.api.llm['analyze-requirements'].$post({
          json: { requirements: inputText, provider },
        });
        const data = await res.json();

        const personas: UserPersona[] = (data.personas ?? []).map((p) => ({
          name: p.name ?? '',
          description: p.description ?? '',
          goals: p.goals ?? [],
          painPoints: [],
        }));

        const features: FeaturePoint[] = (data.features ?? []).map((f) => ({
          name: f.name ?? '',
          description: f.description ?? '',
          priority: f.priority ?? 'medium',
          complexity: 'medium',
        }));

        const scenarios: UseScenario[] = (data.scenarios ?? []).map((s) => {
          const steps = s.steps ?? [];
          return {
            name: s.name ?? '',
            description: s.description ?? '',
            trigger: steps[0] ?? '',
            outcome: steps[steps.length - 1] ?? '',
            relatedPersonas: [],
            relatedFeatures: [],
          };
        });

        const result: RequirementAnalysis = {
          id: nanoid(),
          projectId,
          originalText: inputText,
          personas,
          features,
          scenarios,
          analyzedAt: new Date().toISOString(),
          confidenceScore: 0.9,
        };

        setAnalysis(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '需求分析失败，请稍后重试');
      } finally {
        setAnalyzing(false);
      }
    },
    [inputText, projects, setAnalyzing, setError, setAnalysis],
  );
  /**
   * 基于分析结果生成用户旅程建议（调用 Gateway REST API）
   */
  const generateJourneys = useCallback(async () => {
    if (!analysis) {
      setError('请先完成需求分析');
      return;
    }

    const provider = getLLMProvider(analysis.projectId, projects);

    setGeneratingJourneys(true);
    setError(null);

    try {
      const res = await api.api.llm['generate-journey-suggestions'].$post({
        json: { analysis, provider },
      });
      const data = await res.json();

      const priorities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];

      const suggestions: JourneySuggestion[] = (data.journeys ?? []).map((j, idx) => ({
        id: nanoid(),
        name: j.name ?? '',
        description: j.description ?? '',
        persona: j.persona ?? '',
        stepCount: j.steps?.length ?? 0,
        priority: priorities[Math.min(idx, 2)],
        adopted: false,
        suggestedStories: (j.steps ?? []).map((s) => s.name),
      }));

      setJourneySuggestions(suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : '旅程建议生成失败，请稍后重试');
    } finally {
      setGeneratingJourneys(false);
    }
  }, [analysis, projects, setGeneratingJourneys, setError, setJourneySuggestions]);

  /**
   * 采纳旅程建议
   */
  const adoptJourney = useCallback((suggestionId: string) => {
    useRequirementStore.getState().setJourneyAdopted(suggestionId, true);
  }, []);

  /**
   * 取消采纳旅程建议
   */
  const unadoptJourney = useCallback((suggestionId: string) => {
    useRequirementStore.getState().setJourneyAdopted(suggestionId, false);
  }, []);

  /**
   * 重置分析状态
   */
  const reset = useCallback(() => {
    clearAnalysis();
    setError(null);
  }, [clearAnalysis, setError]);

  return {
    inputText,
    analysis,
    journeySuggestions,
    isAnalyzing,
    isGeneratingJourneys,
    error,
    hasAnalysis: !!analysis,

    setInputText,
    analyze,
    generateJourneys,
    adoptJourney,
    unadoptJourney,
    reset,
  };
}
