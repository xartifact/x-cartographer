'use client';

import { ChevronRight, User } from 'lucide-react';
import type { ActiveTask } from '../active-workbench';
import { TASK_PRIORITY_CLS, TASK_STATUS_LABEL } from './card-meta';

interface TaskCardProps {
  task: ActiveTask;
  onOpen: (task: ActiveTask) => void;
}

export function TaskCard({ task, onOpen }: TaskCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="group w-full rounded-lg border bg-background p-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium leading-snug">{task.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{task.id}</span>
            <span className={TASK_PRIORITY_CLS[task.priority] ?? ''}>{task.priority}</span>
            <span className="rounded bg-muted px-1 py-0.5 text-muted-foreground">
              {TASK_STATUS_LABEL[task.status] ?? task.status}
            </span>
            {task.assignee && (
              <span className="flex items-center gap-0.5 text-muted-foreground">
                <User className="h-3 w-3" />
                {task.assignee}
              </span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
            所属：{task.story_title}
          </p>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </button>
  );
}
