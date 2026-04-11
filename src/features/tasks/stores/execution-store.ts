'use client';

import { create } from 'zustand';

export interface TaskExecutionState {
  taskId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  outputLines: string[];
  error?: string;
  exitCode?: number;
}

interface ExecutionStoreState {
  executions: Record<string, TaskExecutionState>;
  startExecution: (taskId: string) => void;
  appendOutput: (taskId: string, line: string) => void;
  completeExecution: (taskId: string, exitCode: number) => void;
  failExecution: (taskId: string, error: string) => void;
  clearExecution: (taskId: string) => void;
  isRunning: (taskId: string) => boolean;
}

export const useExecutionStore = create<ExecutionStoreState>((set, get) => ({
  executions: {},

  startExecution: (taskId) =>
    set((s) => ({
      executions: {
        ...s.executions,
        [taskId]: {
          taskId,
          status: 'running',
          startedAt: new Date().toISOString(),
          outputLines: [],
        },
      },
    })),

  appendOutput: (taskId, line) =>
    set((s) => {
      const prev = s.executions[taskId];
      if (!prev) return s;
      return {
        executions: {
          ...s.executions,
          [taskId]: {
            ...prev,
            outputLines: [...prev.outputLines, line].slice(-500),
          },
        },
      };
    }),

  completeExecution: (taskId, exitCode) =>
    set((s) => {
      const prev = s.executions[taskId];
      if (!prev) return s;
      return {
        executions: {
          ...s.executions,
          [taskId]: {
            ...prev,
            status: exitCode === 0 ? 'completed' : 'failed',
            completedAt: new Date().toISOString(),
            exitCode,
          },
        },
      };
    }),

  failExecution: (taskId, error) =>
    set((s) => {
      const prev = s.executions[taskId];
      if (!prev) return s;
      return {
        executions: {
          ...s.executions,
          [taskId]: {
            ...prev,
            status: 'failed',
            completedAt: new Date().toISOString(),
            error,
          },
        },
      };
    }),

  clearExecution: (taskId) =>
    set((s) => {
      const next = { ...s.executions };
      delete next[taskId];
      return { executions: next };
    }),

  isRunning: (taskId) => get().executions[taskId]?.status === 'running',
}));
