'use client';

/**
 * 缩放控制组件
 */

import { memo } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStoryMapStore } from '../stores/story-map-store';
import { cn } from '@/lib/utils';

interface ZoomControlsProps {
  className?: string;
}

export const ZoomControls = memo<ZoomControlsProps>(({ className }) => {
  const { zoom, zoomIn, zoomOut, resetZoom } = useStoryMapStore();

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center gap-1 p-1 bg-background rounded-lg border shadow-sm',
          className
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>缩小</TooltipContent>
        </Tooltip>

        <span className="w-12 text-center text-sm font-medium tabular-nums">
          {Math.round(zoom * 100)}%
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>放大</TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={resetZoom}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>重置视图</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});

ZoomControls.displayName = 'ZoomControls';