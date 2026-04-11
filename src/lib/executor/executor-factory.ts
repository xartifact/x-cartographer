import { ClaudeCodeExecutor } from './claude-code-executor';
import { OpenCodeExecutor } from './opencode-executor';
import type { ExecutorType, IExecutor } from './types';

export function createExecutor(type: ExecutorType): IExecutor {
  switch (type) {
    case 'claude-code':
      return new ClaudeCodeExecutor();
    case 'opencode':
      return new OpenCodeExecutor();
    default:
      throw new Error(`未知执行器类型: ${type}`);
  }
}
