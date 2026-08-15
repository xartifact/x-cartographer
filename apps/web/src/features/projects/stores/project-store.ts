/**
 * 项目 UI 状态管理 (Zustand) — 轻量版
 * 仅管理纯 UI 状态：activeProjectId, searchQuery
 * 数据获取和变更通过 tRPC hooks 完成
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const ACTIVE_PROJECT_KEY = 'x-cartographer-active-project';

function getActiveProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export interface ProjectUIState {
  activeProjectId: string | null;
  searchQuery: string;

  setActiveProjectId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  clearSearchQuery: () => void;
}

export const useProjectStore = create<ProjectUIState>()(
  persist(
    (set) => ({
      activeProjectId: getActiveProjectId(),
      searchQuery: '',

      setActiveProjectId: (id) => {
        if (typeof window !== 'undefined') {
          if (id === null) localStorage.removeItem(ACTIVE_PROJECT_KEY);
          else localStorage.setItem(ACTIVE_PROJECT_KEY, id);
        }
        set({ activeProjectId: id });
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      clearSearchQuery: () => {
        set({ searchQuery: '' });
      },
    }),
    {
      name: 'project-store',
      partialize: (state) => ({
        activeProjectId: state.activeProjectId,
        searchQuery: state.searchQuery,
      }),
    }
  )
);

export const selectActiveProjectId = (state: ProjectUIState) => state.activeProjectId;
export const selectSearchQuery = (state: ProjectUIState) => state.searchQuery;
