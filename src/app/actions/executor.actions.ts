'use server';

import { AppSettingsRepository } from '@/lib/db/repositories/app-settings.repository';
import type { ExecutorConfig } from '@/lib/executor/types';

const repo = new AppSettingsRepository();

export async function getExecutorConfig(): Promise<ExecutorConfig> {
  const [preferred, workspaceDir, timeoutMs] = await Promise.all([
    repo.get('executor_preferred'),
    repo.get('executor_workspace_dir'),
    repo.get('executor_timeout_ms'),
  ]);
  return {
    preferred_executor: (preferred ?? 'claude-code') as ExecutorConfig['preferred_executor'],
    default_workspace_dir: workspaceDir ?? undefined,
    timeout_ms: timeoutMs ? parseInt(timeoutMs, 10) : 300_000,
  };
}

export async function saveExecutorConfig(config: Partial<ExecutorConfig>): Promise<void> {
  const ops: Promise<void>[] = [];
  if (config.preferred_executor !== undefined) {
    ops.push(repo.set('executor_preferred', config.preferred_executor));
  }
  if (config.default_workspace_dir !== undefined) {
    ops.push(repo.set('executor_workspace_dir', config.default_workspace_dir));
  }
  if (config.timeout_ms !== undefined) {
    ops.push(repo.set('executor_timeout_ms', String(config.timeout_ms)));
  }
  await Promise.all(ops);
}
