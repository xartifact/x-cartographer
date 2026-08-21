'use client';

import { Briefcase, FileText, ListTodo } from 'lucide-react';

interface StatsBarProps {
  projectCount: number;
  activeStoryCount: number;
  activeTaskCount: number;
}

export function StatsBar({ projectCount, activeStoryCount, activeTaskCount }: StatsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
        <Briefcase className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold">{projectCount}</span>
        <span className="text-muted-foreground">并行项目</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold">{activeStoryCount}</span>
        <span className="text-muted-foreground">活跃需求</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
        <ListTodo className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold">{activeTaskCount}</span>
        <span className="text-muted-foreground">活跃任务</span>
      </div>
    </div>
  );
}
