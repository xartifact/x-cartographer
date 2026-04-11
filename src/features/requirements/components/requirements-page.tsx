/**
 * 需求页面主组件
 *
 * 整合需求输入、分析结果展示和用户旅程建议
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Grid3X3, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRequirementAnalysis } from '../hooks/use-requirement-analysis';
import { useDraftAutosave } from '../hooks/use-draft-autosave';
import { RequirementInput } from './requirement-input';
import { AnalysisResult } from './analysis-result';
import { JourneySuggestions } from './journey-suggestions';
import { useProjectStore } from '@/features/projects/stores';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';
import type { UserJourney, UserStory } from '@/types';
import { Priority } from '@/types';
import type { JourneySuggestion } from '../types';

/**
 * 视图模式
 */
type ViewMode = 'split' | 'input' | 'result';

/**
 * 需求页面组件
 */
export function RequirementsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const { projects, modifyProject } = useProjectStore();

  // 从 Hook 获取状态和方法
  const {
    inputText,
    analysis,
    journeySuggestions,
    isAnalyzing,
    isGeneratingJourneys,
    error,
    hasAnalysis,
    setInputText,
    analyze,
    generateJourneys,
    adoptJourney,
    unadoptJourney,
    reset,
  } = useRequirementAnalysis();

  // 草稿自动保存
  const { lastSavedTime } = useDraftAutosave(projectId);

  // 视图模式
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  // 是否正在处理旅程添加到项目
  const [isApplyingJourney, setIsApplyingJourney] = useState(false);

  // 初始化加载状态
  const [isInitializing, setIsInitializing] = useState(true);

  // 初始化
  useEffect(() => {
    // 模拟初始化延迟
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // 处理分析
  const handleAnalyze = () => {
    analyze(projectId);
  };

  // 处理重新分析
  const handleReanalyze = () => {
    reset();
    setTimeout(() => analyze(projectId), 100);
  };

  // 处理生成旅程
  const handleGenerateJourneys = () => {
    generateJourneys();
  };

  // 处理采纳旅程
  const handleToggleAdopt = (id: string) => {
    const suggestion = journeySuggestions.find((s) => s.id === id);
    if (suggestion) {
      if (suggestion.adopted) {
        unadoptJourney(id);
      } else {
        adoptJourney(id);
      }
    }
  };

  // 将 JourneySuggestion 转换为 UserJourney
  function suggestionToJourney(s: JourneySuggestion, order: number): UserJourney {
    const now = new Date().toISOString();
    const stories: UserStory[] = s.suggestedStories.map((title, idx) => ({
      id: `US-${nanoid(8)}`,
      journey_id: '', // 稍后由 modifyProject 关联
      title,
      description: '',
      priority: Priority.MEDIUM,
      estimation: 0,
      acceptance_criteria: [],
      tags: [],
      tasks: [],
      order: idx,
      status: 'backlog' as const,
      created_at: now,
      updated_at: now,
    }));

    const journey: UserJourney = {
      id: `UJ-${nanoid(8)}`,
      project_id: projectId,
      name: s.name,
      description: s.description,
      persona: s.persona,
      stories,
      order,
      created_at: now,
      updated_at: now,
    };

    // 补充 story.journey_id
    journey.stories = stories.map((st) => ({ ...st, journey_id: journey.id }));
    return journey;
  }

  // 批量添加所有已采纳的旅程到项目（一次事务）
  const handleApplyAllAdopted = async () => {
    const adopted = journeySuggestions.filter((s) => s.adopted);
    if (!adopted.length) return;

    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    setIsApplyingJourney(true);
    try {
      const base = project.user_journeys ?? [];
      const newJourneys = adopted.map((s, i) => suggestionToJourney(s, base.length + i));
      await modifyProject(projectId, { user_journeys: [...base, ...newJourneys] });
      adopted.forEach((s) => adoptJourney(s.id));
    } finally {
      setIsApplyingJourney(false);
    }
  };

  // 处理添加到项目
  const handleApplyJourney = async (id: string) => {
    const suggestion = journeySuggestions.find((s) => s.id === id);
    if (!suggestion) return;

    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    setIsApplyingJourney(true);
    try {
      const existingJourneys = project.user_journeys ?? [];
      const newJourney = suggestionToJourney(suggestion, existingJourneys.length);
      await modifyProject(projectId, {
        user_journeys: [...existingJourneys, newJourney],
      });
      // 标记为已采纳
      adoptJourney(id);
    } finally {
      setIsApplyingJourney(false);
    }
  };

  // 加载状态
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {lastSavedTime && `草稿已保存`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 视图切换 */}
          <div className="flex items-center border rounded-md p-1">
            <Button
              variant={viewMode === 'input' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('input')}
              className="px-3"
            >
              输入
            </Button>
            <Button
              variant={viewMode === 'result' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('result')}
              className="px-3"
            >
              结果
            </Button>
            <Button
              variant={viewMode === 'split' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('split')}
              className="px-3"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div
        className={cn(
          'grid gap-4',
          viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        )}
      >
        {/* 左侧：需求输入 */}
        {(viewMode === 'split' || viewMode === 'input') && (
          <RequirementInput
            projectId={projectId}
            value={inputText}
            onChange={setInputText}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleAnalyze}
            error={error}
          />
        )}

        {/* 右侧：分析结果和旅程建议 */}
        {(viewMode === 'split' || viewMode === 'result') && (
          <div className="space-y-4">
            {/* 分析结果 */}
            <AnalysisResult
              analysis={analysis}
              canReanalyze={hasAnalysis}
              onReanalyze={handleReanalyze}
              onGenerateJourneys={handleGenerateJourneys}
              isGeneratingJourneys={isGeneratingJourneys}
            />

            {/* 用户旅程建议 */}
            <JourneySuggestions
              suggestions={journeySuggestions}
              onToggleAdopt={handleToggleAdopt}
              onApply={handleApplyJourney}
              onApplyAll={handleApplyAllAdopted}
              isProcessing={isApplyingJourney}
            />
          </div>
        )}
      </div>

      {/* 快捷操作 */}
      {hasAnalysis && (
        <div className="flex justify-center gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleReanalyze}>
            <Sparkles className="h-4 w-4 mr-2" />
            重新分析
          </Button>
          {!journeySuggestions.length && (
            <Button
              onClick={handleGenerateJourneys}
              disabled={isGeneratingJourneys}
            >
              {isGeneratingJourneys ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  生成旅程建议
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}