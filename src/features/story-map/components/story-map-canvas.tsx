'use client';

/**
 * 故事地图画布组件
 */

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  BackgroundVariant,
  Panel,
  Node,
  Edge,
  Connection,
  NodeTypes,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Loader2, Map } from 'lucide-react';
import { StoryNode } from './story-node';
import { StoryDetailPanel } from './story-detail-panel';
import { FilterPanel } from './filter-panel';
import { ZoomControls } from './zoom-controls';
import { useStoryMapStore, filterStories } from '../stores/story-map-store';
import type { StoryNodeData } from '../types';
import { Priority } from '@/types';
import { UserJourney, UserStory } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface StoryMapCanvasProps {
  /** 用户旅程列表 */
  journeys: UserJourney[];
  /** 当前项目 ID */
  projectId: string;
  className?: string;
}

// 列宽和行高配置
const COLUMN_WIDTH = 280;
const ROW_HEIGHT = 140;
const HEADER_HEIGHT = 100;
const COLUMN_GAP = 24;

// 自定义节点类型 - 使用类型断言
const nodeTypes: NodeTypes = {
  story: StoryNode as any,
};

// 旅程头组件（简单版本）
function JourneyHeader({ data }: { data: { journeyName: string; storyCount: number } }) {
  return (
    <div className="flex items-center justify-center">
      <div className="w-64 bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
        <h3 className="font-semibold text-sm line-clamp-2">{data.journeyName}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {data.storyCount} 个故事
        </p>
      </div>
    </div>
  );
}

// 空节点组件
function EmptyNode() {
  return (
    <div className="w-64 h-24 flex items-center justify-center">
      <p className="text-sm text-muted-foreground italic">暂无故事</p>
    </div>
  );
}

// 合并节点类型
const allNodeTypes: NodeTypes = {
  story: StoryNode as any,
  journeyHeader: JourneyHeader as any,
  empty: EmptyNode as any,
};

export function StoryMapCanvas({ journeys, className }: StoryMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 从 store 获取状态
  const {
    selectedStory,
    setSelectedStory,
    filter,
  } = useStoryMapStore();

  // 筛选后的旅程
  const filteredJourneys = useMemo(
    () => filterStories(journeys, filter),
    [journeys, filter]
  );

  // 计算节点和边
  const { nodes, edges } = useMemo(() => {
    const newNodes: Node<any>[] = [];
    const newEdges: Edge[] = [];

    let currentX = COLUMN_GAP;

    filteredJourneys.forEach((journey) => {
      // 添加旅程头节点
      newNodes.push({
        id: `journey-header-${journey.id}`,
        type: 'journeyHeader',
        position: { x: currentX, y: 0 },
        data: {
          journeyName: journey.name,
          storyCount: journey.stories?.length || 0,
        },
        draggable: false,
      });

      // 按优先级排序故事
      const sortedStories = [...(journey.stories || [])].sort((a, b) => {
        const priorityOrder = { [Priority.HIGH]: 0, [Priority.MEDIUM]: 1, [Priority.LOW]: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // 添加故事节点
      sortedStories.forEach((story, storyIndex) => {
        const nodeId = `story-${story.id}`;
        const nodeY = HEADER_HEIGHT + storyIndex * ROW_HEIGHT;

        newNodes.push({
          id: nodeId,
          type: 'story',
          position: { x: currentX, y: nodeY },
          data: {
            story,
            journeyName: journey.name,
            isSelected: selectedStory?.id === story.id,
            onSelect: (s: UserStory) => setSelectedStory(s),
          },
          draggable: false,
        });

        // 创建连接线
        if (storyIndex === 0) {
          newEdges.push({
            id: `edge-${journey.id}-${story.id}`,
            source: `journey-header-${journey.id}`,
            target: nodeId,
            type: 'smoothstep',
            animated: false,
            style: { stroke: 'hsl(var(--border))', strokeWidth: 1 },
          });
        } else {
          const prevStory = sortedStories[storyIndex - 1];
          newEdges.push({
            id: `edge-${journey.id}-${story.id}`,
            source: `story-${prevStory.id}`,
            target: nodeId,
            type: 'smoothstep',
            animated: false,
            style: { stroke: 'hsl(var(--border))', strokeWidth: 1 },
          });
        }
      });

      // 添加空节点占位
      if (sortedStories.length === 0) {
        newNodes.push({
          id: `empty-${journey.id}`,
          type: 'empty',
          position: { x: currentX, y: HEADER_HEIGHT },
          data: {},
          draggable: false,
        });
      }

      currentX += COLUMN_WIDTH + COLUMN_GAP;
    });

    return { nodes: newNodes, edges: newEdges };
  }, [filteredJourneys, selectedStory, setSelectedStory]);

  // 处理节点点击
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<any>) => {
      if (node.type === 'story' && node.data.story) {
        setSelectedStory(node.data.story);
      }
    },
    [setSelectedStory]
  );

  // 处理画布点击
  const onPaneClick = useCallback(() => {
    setSelectedStory(null);
  }, [setSelectedStory]);

  // 查找选中故事对应的旅程名称
  const selectedJourneyName = useMemo(() => {
    if (!selectedStory) return undefined;
    const journey = journeys.find((j) => j.id === selectedStory.journey_id);
    return journey?.name;
  }, [selectedStory, journeys]);

  // 空状态
  if (journeys.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-96 border rounded-lg', className)}>
        <div className="text-center">
          <Map className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">暂无用户旅程</h3>
          <p className="text-sm text-muted-foreground mb-4">
            请先添加用户旅程和用户故事
          </p>
          <Button variant="outline" size="sm">
            前往需求分析
          </Button>
        </div>
      </div>
    );
  }

  // 空筛选结果
  if (filteredJourneys.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-96 border rounded-lg', className)}>
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">无匹配的故事</h3>
          <p className="text-sm text-muted-foreground">
            尝试调整筛选条件
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('flex h-full gap-4', className)}>
      {/* 筛选面板 */}
      <FilterPanel journeys={journeys} className="shrink-0" />

      {/* React Flow 画布 */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={allNodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          minZoom={0.25}
          maxZoom={2}
          zoomOnScroll={true}
          zoomOnPinch={true}
          panOnScroll={true}
          panOnDrag={true}
          fitView={false}
          nodesDraggable={false}
          nodesConnectable={false}
          className="bg-background"
        >
          {/* 背景网格 */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="hsl(var(--border))"
          />

          {/* 缩放控制 */}
          <Panel position="top-right">
            <ZoomControls />
          </Panel>

          {/* 旅程统计 */}
          <Panel position="top-left">
            <div className="text-sm text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border">
              <span className="font-medium">{filteredJourneys.length}</span> 个旅程，
              <span className="font-medium ml-1">
                {filteredJourneys.reduce((acc, j) => acc + (j.stories?.length || 0), 0)}
              </span>
              {' '}个故事
            </div>
          </Panel>

          {/* 控制按钮 */}
          <Controls
            className="bg-background border rounded-lg shadow-sm"
            showZoom={false}
            showFitView={true}
            showInteractive={false}
          />
        </ReactFlow>
      </div>

      {/* 详情面板 */}
      <div className="shrink-0">
        <StoryDetailPanel
          story={selectedStory}
          journeyName={selectedJourneyName}
          onClose={() => setSelectedStory(null)}
        />
      </div>
    </div>
  );
}