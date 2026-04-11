export type ExecutorType = 'claude-code' | 'opencode';

export type ExecutionEventType =
  | 'started'
  | 'output'
  | 'status_update'
  | 'complete'
  | 'error';

export interface ExecutionEvent {
  type: ExecutionEventType;
  taskId: string;
  timestamp: string;
  data?: string;
  exitCode?: number;
  newStatus?: string;
  error?: string;
}

export interface RawOutputEvent {
  type: 'stdout' | 'stderr';
  data: string;
}

export interface ExecutionResult {
  exitCode: number;
  success: boolean;
  durationMs: number;
}

export interface IExecutor {
  execute(
    prompt: string,
    workspaceDir: string,
    onEvent: (event: RawOutputEvent) => void,
    signal: AbortSignal
  ): Promise<ExecutionResult>;
}

export interface ExecutorConfig {
  preferred_executor: ExecutorType;
  default_workspace_dir?: string;
  timeout_ms: number;
}

export interface PromptContext {
  task: {
    id: string;
    title: string;
    description: string;
    type: string;
    priority: string;
    tags: string[];
    dependencies: string[];
  };
  story?: {
    id: string;
    title: string;
    description: string;
    acceptance_criteria: string[];
  };
  project?: {
    name: string;
    description?: string;
    tech_stack: string[];
  };
}
