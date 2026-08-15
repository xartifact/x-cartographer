'use client';

/**
 * 缩放控制组件
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Focus, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@xpm/ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@xpm/ui';
import { useReactFlow, useStore } from '@xyflow/react';
import { cn } from '@/lib/utils';

interface ZoomControlsProps {
  className?: string;
}

const zoomSelector = (state: { transform: [number, number, number] }) =>
  state.transform[2];

export const ZoomControls = memo<ZoomControlsProps>(({ className }) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore(zoomSelector);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 });
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView({ duration: 300, padding: 0.1 });
  }, [fitView]);

  const handleFullscreen = useCallback(() => {
    const canvas = document.querySelector('[data-story-map-canvas]');
    if (!canvas) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      canvas.requestFullscreen();
    }
  }, []);

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center gap-1 rounded-lg border bg-background p-1 shadow-sm',
          className
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleZoomOut}>
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
            <Button variant="ghost" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>放大</TooltipContent>
        </Tooltip>

        <div className="mx-1 h-4 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleFitView}>
              <Focus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>适配视图</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleFullscreen}>
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isFullscreen ? '退出全屏' : '全屏'}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});

ZoomControls.displayName = 'ZoomControls';
