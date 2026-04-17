/**
 * 需求页面主组件
 */

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Grid3X3 } from 'lucide-react';
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

type ViewMode = 'split' | 'input' | 'result';

export function RequirementsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const { projects, modifyProject } = useProjectStore();
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

  const { lastSavedTime } = useDraftAutosave(projectId);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [isApplyingJourney, setIsApplyingJourney] = useState(false);

  const handleReanalyze = () => {
    reset();
    setTimeout(() => analyze(projectId), 100);
  };

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

  function suggestionToJourney(
    s: JourneySuggestion,
    order: number
  ): UserJourney {
    const now = new Date().toISOString();
    const stories: UserStory[] = s.suggestedStories.map((title, idx) => ({
      id: `US-${nanoid(8)}`,
      journey_id: '',
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

    journey.stories = stories.map((st) => ({ ...st, journey_id: journey.id }));
    return journey;
  }

  const handleApplyAllAdopted = async () => {
    const adopted = journeySuggestions.filter((s) => s.adopted);
    if (!adopted.length) return;

    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    setIsApplyingJourney(true);
    try {
      const base = project.user_journeys ?? [];
      const newJourneys = adopted.map((s, i) =>
        suggestionToJourney(s, base.length + i)
      );
      await modifyProject(projectId, {
        user_journeys: [...base, ...newJourneys],
      });
      adopted.forEach((s) => adoptJourney(s.id));
    } finally {
      setIsApplyingJourney(false);
    }
  };

  const handleApplyJourney = async (id: string) => {
    const suggestion = journeySuggestions.find((s) => s.id === id);
    if (!suggestion) return;

    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    setIsApplyingJourney(true);
    try {
      const existingJourneys = project.user_journeys ?? [];
      const newJourney = suggestionToJourney(
        suggestion,
        existingJourneys.length
      );
      await modifyProject(projectId, {
        user_journeys: [...existingJourneys, newJourney],
      });
      adoptJourney(id);
    } finally {
      setIsApplyingJourney(false);
    }
  };

  const showLeft = viewMode === 'split' || viewMode === 'input';
  const showRight = viewMode === 'split' || viewMode === 'result';

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 顶部工具栏 */}
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {lastSavedTime ? '草稿已自动保存' : ''}
        </span>

        <div className="flex items-center rounded-md border p-0.5">
          <Button
            variant={viewMode === 'input' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('input')}
            className="h-7 px-3 text-xs"
          >
            输入
          </Button>
          <Button
            variant={viewMode === 'split' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('split')}
            className="h-7 px-2"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'result' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('result')}
            className="h-7 px-3 text-xs"
          >
            结果
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div
        className={cn(
          'grid min-h-0 flex-1 gap-4',
          viewMode === 'split' ? 'grid-cols-2' : 'grid-cols-1'
        )}
      >
        {/* 左侧：需求输入 */}
        {showLeft && (
          <RequirementInput
            projectId={projectId}
            value={inputText}
            onChange={setInputText}
            isAnalyzing={isAnalyzing}
            onAnalyze={() => analyze(projectId)}
            error={error}
          />
        )}

        {/* 右侧：分析结果 + 旅程建议 */}
        {showRight && (
          <div className="flex min-h-0 flex-col gap-4 overflow-auto">
            <AnalysisResult
              analysis={analysis}
              canReanalyze={hasAnalysis}
              onReanalyze={handleReanalyze}
              onGenerateJourneys={generateJourneys}
              isGeneratingJourneys={isGeneratingJourneys}
            />

            {journeySuggestions.length > 0 && (
              <JourneySuggestions
                suggestions={journeySuggestions}
                onToggleAdopt={handleToggleAdopt}
                onApply={handleApplyJourney}
                onApplyAll={handleApplyAllAdopted}
                isProcessing={isApplyingJourney}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
