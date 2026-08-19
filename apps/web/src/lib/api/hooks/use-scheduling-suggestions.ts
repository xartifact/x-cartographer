'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { LLMProvider } from '@x-cartographer/shared';

/**
 * AI 排期建议 hooks
 */

export interface SchedulingAssignment {
  story_id: string;
  milestone_id: string;
  milestone_name: string;
  reason: string;
}

export function useSchedulingSuggestions() {
  return useMutation({
    mutationFn: async (variables: { projectId: string; provider: LLMProvider }) => {
      const res = await api.api.llm['scheduling-suggestions'].$post({
        json: { projectId: variables.projectId, provider: variables.provider },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? '排期建议生成失败');
      }
      return data as { assignments: SchedulingAssignment[]; message?: string };
    },
  });
}
