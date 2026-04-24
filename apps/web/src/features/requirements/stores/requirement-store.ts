/**
 * 需求状态管理 (Zustand)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { RequirementState, RequirementAnalysis, JourneySuggestion } from '../types';

/**
 * 需求 Store 接口
 */
interface RequirementStore extends RequirementState {
  /** 设置输入文本 */
  setInputText: (text: string) => void;

  /** 设置分析结果 */
  setAnalysis: (analysis: RequirementAnalysis | null) => void;

  /** 设置旅程建议 */
  setJourneySuggestions: (suggestions: JourneySuggestion[]) => void;

  /** 添加旅程建议 */
  addJourneySuggestion: (suggestion: JourneySuggestion) => void;

  /** 更新旅程建议采纳状态 */
  setJourneyAdopted: (id: string, adopted: boolean) => void;

  /** 设置分析中状态 */
  setAnalyzing: (isAnalyzing: boolean) => void;

  /** 设置生成旅程中状态 */
  setGeneratingJourneys: (isGenerating: boolean) => void;

  /** 设置错误信息 */
  setError: (error: string | null) => void;

  /** 重置状态 */
  reset: () => void;

  /** 清空分析结果 */
  clearAnalysis: () => void;
}

/**
 * 初始状态
 */
const initialState: RequirementState = {
  inputText: '',
  analysis: null,
  journeySuggestions: [],
  isAnalyzing: false,
  isGeneratingJourneys: false,
  error: null,
};

/**
 * 需求 Store
 *
 * 使用 Zustand + persist 中间件实现本地存储持久化
 */
export const useRequirementStore = create<RequirementStore>()(
  persist(
    (set) => ({
      ...initialState,

      setInputText: (text: string) =>
        set((state) => ({
          inputText: text,
          // 输入新内容时清除之前的错误
          error: state.error?.includes('分析') ? null : state.error,
        })),

      setAnalysis: (analysis: RequirementAnalysis | null) =>
        set((_state) => ({
          analysis,
          isAnalyzing: false,
          error: null,
        })),

      setJourneySuggestions: (suggestions: JourneySuggestion[]) =>
        set((_state) => ({
          journeySuggestions: suggestions,
          isGeneratingJourneys: false,
        })),

      addJourneySuggestion: (suggestion: JourneySuggestion) =>
        set((state) => ({
          journeySuggestions: [...state.journeySuggestions, suggestion],
        })),

      setJourneyAdopted: (id: string, adopted: boolean) =>
        set((state) => ({
          journeySuggestions: state.journeySuggestions.map((s) =>
            s.id === id ? { ...s, adopted } : s
          ),
        })),

      setAnalyzing: (isAnalyzing: boolean) =>
        set({ isAnalyzing }),

      setGeneratingJourneys: (isGenerating: boolean) =>
        set({ isGeneratingJourneys: isGenerating }),

      setError: (error: string | null) =>
        set({ error, isAnalyzing: false, isGeneratingJourneys: false }),

      reset: () =>
        set(initialState),

      clearAnalysis: () =>
        set((_state) => ({
          analysis: null,
          journeySuggestions: [],
          error: null,
        })),
    }),
    {
      name: 'requirement-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        inputText: state.inputText,
        analysis: state.analysis,
        journeySuggestions: state.journeySuggestions,
      }),
    }
  )
);