'use client';

import { FileText, MapPin, ChevronRight } from 'lucide-react';
import type { ActiveStory } from '../active-workbench';
import { STORY_PRIORITY_CLS, STORY_STATUS_LABEL } from './card-meta';

interface StoryCardProps {
  story: ActiveStory;
  onOpen: (story: ActiveStory) => void;
}

export function StoryCard({ story, onOpen }: StoryCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(story)}
      className="group w-full rounded-lg border bg-background p-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium leading-snug">{story.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{story.id}</span>
            <span className={STORY_PRIORITY_CLS[story.priority] ?? ''}>{story.priority}</span>
            <span className="rounded bg-muted px-1 py-0.5 text-muted-foreground">
              {STORY_STATUS_LABEL[story.status ?? ''] ?? story.status}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {story.journey_name}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {story.active_task_count} 活跃任务
            </span>
          </div>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </button>
  );
}
