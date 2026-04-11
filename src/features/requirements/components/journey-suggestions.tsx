/**
 * 用户旅程建议组件
 */

'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Map,
  Sparkles,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Users,
  ListTodo,
} from 'lucide-react';
import type { JourneySuggestion } from '../types';

// 优先级颜色
const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

/**
 * 旅程建议卡片组件
 */
function JourneySuggestionCard({
  suggestion,
  onToggle,
  onApply,
  isProcessing,
}: {
  suggestion: JourneySuggestion;
  onToggle: (id: string) => void;
  onApply: (id: string) => void;
  isProcessing: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden transition-all',
        suggestion.adopted
          ? 'border-primary bg-primary/5'
          : 'hover:shadow-sm'
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`journey-${suggestion.id}`}
            checked={suggestion.adopted}
            onCheckedChange={() => onToggle(suggestion.id)}
            className="mt-1"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <label
                  htmlFor={`journey-${suggestion.id}`}
                  className="font-semibold cursor-pointer"
                >
                  {suggestion.name}
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  {suggestion.description}
                </p>
              </div>

              <Badge className={cn('text-xs shrink-0', priorityColors[suggestion.priority])}>
                {suggestion.priority}
              </Badge>
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {suggestion.persona}
              </div>
              <div className="flex items-center gap-1">
                <ListTodo className="h-3.5 w-3.5" />
                {suggestion.stepCount} 个步骤
              </div>
              <div className="flex items-center gap-1">
                <Map className="h-3.5 w-3.5" />
                {suggestion.suggestedStories.length} 个故事
              </div>
            </div>

            {/* 展开/收起用户故事列表 */}
            {suggestion.suggestedStories.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    收起建议的用户故事
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    查看建议的用户故事 ({suggestion.suggestedStories.length})
                  </>
                )}
              </button>
            )}

            {/* 用户故事列表 */}
            {isExpanded && suggestion.suggestedStories.length > 0 && (
              <ul className="mt-3 space-y-2">
                {suggestion.suggestedStories.map((story, index) => (
                  <li
                    key={index}
                    className="text-sm p-2 bg-muted/50 rounded text-muted-foreground"
                  >
                    {story}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {suggestion.adopted && (
        <div className="px-4 py-2 bg-primary/10 border-t flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle(suggestion.id)}
            className="text-destructive hover:text-destructive"
          >
            <Minus className="h-4 w-4 mr-1" />
            取消采纳
          </Button>
          <Button
            size="sm"
            onClick={() => onApply(suggestion.id)}
            disabled={isProcessing}
          >
            <Plus className="h-4 w-4 mr-1" />
            添加到项目
          </Button>
        </div>
      )}
    </div>
  );
}

interface JourneySuggestionsProps {
  /** 旅程建议列表 */
  suggestions: JourneySuggestion[];

  /** 切换采纳状态回调 */
  onToggleAdopt: (id: string) => void;

  /** 单个旅程添加到项目 */
  onApply: (id: string) => void;

  /** 批量添加所有已采纳的旅程到项目 */
  onApplyAll?: () => void;

  /** 是否正在处理 */
  isProcessing: boolean;

  /** 类名 */
  className?: string;
}

export function JourneySuggestions({
  suggestions,
  onToggleAdopt,
  onApply,
  onApplyAll,
  isProcessing,
  className,
}: JourneySuggestionsProps) {
  // 过滤采纳和未采纳的
  const adoptedCount = suggestions.filter((s) => s.adopted).length;
  const pendingCount = suggestions.filter((s) => !s.adopted).length;

  if (suggestions.length === 0) {
    return (
      <Card className={cn('h-full', className)}>
        <CardContent className="flex items-center justify-center h-[200px]">
          <div className="text-center text-muted-foreground">
            <Map className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>完成需求分析后，将生成用户旅程建议</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Map className="h-5 w-5 text-primary" />
              用户旅程建议
            </CardTitle>
            <CardDescription>
              已选择 {adoptedCount} / {suggestions.length} 个旅程
            </CardDescription>
          </div>

          {adoptedCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={onApplyAll ?? (() => suggestions.filter((s) => s.adopted).forEach((s) => onApply(s.id)))}
              disabled={isProcessing}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              批量添加到项目
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
        {/* 未采纳的旅程 */}
        {pendingCount > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              可选旅程 ({pendingCount})
            </h4>
            {suggestions
              .filter((s) => !s.adopted)
              .map((suggestion) => (
                <JourneySuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onToggle={onToggleAdopt}
                  onApply={onApply}
                  isProcessing={isProcessing}
                />
              ))}
          </div>
        )}

        {/* 已采纳的旅程 */}
        {adoptedCount > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              已选择 ({adoptedCount})
            </h4>
            {suggestions
              .filter((s) => s.adopted)
              .map((suggestion) => (
                <JourneySuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onToggle={onToggleAdopt}
                  onApply={onApply}
                  isProcessing={isProcessing}
                />
              ))}
          </div>
        )}

        {/* 空状态 */}
        {suggestions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            暂无旅程建议
          </div>
        )}
      </CardContent>
    </Card>
  );
}