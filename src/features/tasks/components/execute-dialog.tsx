'use client';

import * as React from 'react';
import { Play, Square, Loader2, Terminal, Bot } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getExecutorConfig, saveExecutorConfig } from '@/app/actions/executor.actions';
import { useExecutionStore } from '../stores/execution-store';
import type { Task, TaskStatus } from '@/types';
import type { ExecutionEvent, ExecutorType, PromptContext } from '@/lib/executor/types';
import type { ExecuteTaskBody } from '@/app/api/tasks/[id]/execute/route';

export interface ExecuteDialogStoryContext {
  id: string;
  title: string;
  description: string;
  acceptance_criteria: string[];
}

export interface ExecuteDialogProjectContext {
  name: string;
  description?: string;
  tech_stack: string[];
}

interface ExecuteDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  story?: ExecuteDialogStoryContext;
  project?: ExecuteDialogProjectContext;
}

const EXECUTOR_OPTIONS: { value: ExecutorType; label: string; desc: string }[] = [
  { value: 'claude-code', label: 'Claude Code', desc: 'Anthropic Claude Code CLI' },
  { value: 'opencode', label: 'OpenCode', desc: 'OpenCode AI 编码助手' },
];

export function ExecuteDialog({
  task,
  open,
  onOpenChange,
  onStatusChange,
  story,
  project,
}: ExecuteDialogProps) {
  const [executorType, setExecutorType] = React.useState<ExecutorType>('claude-code');
  const [workspaceDir, setWorkspaceDir] = React.useState('');
  const [isRunning, setIsRunning] = React.useState(false);
  const outputRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const { startExecution, appendOutput, completeExecution, failExecution, executions } =
    useExecutionStore();

  const execution = task ? executions[task.id] : null;

  // 加载默认配置
  React.useEffect(() => {
    if (!open) return;
    getExecutorConfig().then((cfg) => {
      setExecutorType(cfg.preferred_executor);
      if (cfg.default_workspace_dir) setWorkspaceDir(cfg.default_workspace_dir);
    });
  }, [open]);

  // 对话框关闭时中止正在进行的请求
  React.useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setIsRunning(false);
    }
  }, [open]);

  // 自动滚动输出到底部
  React.useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [execution?.outputLines.length]);

  async function handleStart() {
    if (!task || !workspaceDir.trim() || isRunning) return;

    setIsRunning(true);
    startExecution(task.id);
    saveExecutorConfig({ preferred_executor: executorType, default_workspace_dir: workspaceDir });

    const ac = new AbortController();
    abortRef.current = ac;

    // 通知父组件状态变为 in_progress
    onStatusChange?.(task.id, 'in_progress' as TaskStatus);

    const context: PromptContext = {
      task: {
        id: task.id,
        title: task.title,
        description: task.description ?? '',
        type: task.type ?? 'technical_task',
        priority: task.priority ?? 'P2',
        tags: task.tags ?? [],
        dependencies: task.dependencies ?? [],
      },
      story,
      project,
    };

    const body: ExecuteTaskBody = {
      executor: executorType,
      workspaceDir,
      context,
    };

    try {
      const response = await fetch(`/api/tasks/${task.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ac.signal,
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        failExecution(task.id, err.error ?? `HTTP ${response.status}`);
        setIsRunning(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      // 读取 SSE 流
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split('\n\n');
        buf = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const line = chunk.replace(/^data: /, '').trim();
          if (!line) continue;
          try {
            const event = JSON.parse(line) as ExecutionEvent;
            handleEvent(event, task.id);
          } catch {
            // 非 JSON 行忽略
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      failExecution(task.id, (err as Error).message ?? '请求失败');
    } finally {
      setIsRunning(false);
    }
  }

  function handleEvent(event: ExecutionEvent, taskId: string) {
    switch (event.type) {
      case 'output':
        if (event.data) appendOutput(taskId, event.data);
        break;
      case 'complete':
        completeExecution(taskId, event.exitCode ?? 0);
        onStatusChange?.(taskId, 'in_review' as TaskStatus);
        break;
      case 'error':
        failExecution(taskId, event.error ?? '未知错误');
        break;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    abortRef.current = null;
    if (task) failExecution(task.id, '用户手动停止');
    setIsRunning(false);
  }

  const outputLines = execution?.outputLines ?? [];
  const execStatus = execution?.status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI 执行任务
          </DialogTitle>
        </DialogHeader>

        {task && (
          <div className="space-y-4">
            {/* 任务信息 */}
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">{task.id}</span>
                <Badge variant="secondary" className="text-xs">{task.priority}</Badge>
              </div>
              <p className="text-sm font-medium">{task.title}</p>
            </div>

            {/* 执行器选择 */}
            <div className="space-y-2">
              <Label>执行器</Label>
              <div className="flex gap-2">
                {EXECUTOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setExecutorType(opt.value)}
                    disabled={isRunning}
                    className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                      executorType === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 工作目录 */}
            <div className="space-y-2">
              <Label htmlFor="workspace-dir">工作目录（代码仓库绝对路径）</Label>
              <Input
                id="workspace-dir"
                placeholder="/path/to/your/project"
                value={workspaceDir}
                onChange={(e) => setWorkspaceDir(e.target.value)}
                disabled={isRunning}
                className="font-mono text-sm"
              />
            </div>

            {/* 输出区域 */}
            {(outputLines.length > 0 || isRunning) && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Terminal className="h-3 w-3 text-muted-foreground" />
                  <Label className="text-xs text-muted-foreground">执行输出</Label>
                  {isRunning && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                  {execStatus === 'completed' && (
                    <span className="text-xs text-green-600">执行完成</span>
                  )}
                  {execStatus === 'failed' && (
                    <span className="text-xs text-red-500">
                      {execution?.error ?? '执行失败'}
                    </span>
                  )}
                </div>
                <div
                  ref={outputRef}
                  className="rounded-md border bg-black/90 p-3 h-64 overflow-y-auto font-mono text-xs text-green-400 whitespace-pre-wrap"
                >
                  {outputLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                  {isRunning && <span className="animate-pulse">▋</span>}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRunning}>
            {isRunning ? '执行中…' : '关闭'}
          </Button>
          {isRunning ? (
            <Button variant="destructive" onClick={handleStop}>
              <Square className="h-4 w-4 mr-2" />
              停止
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={!workspaceDir.trim() || execStatus === 'completed'}
            >
              <Play className="h-4 w-4 mr-2" />
              开始执行
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
