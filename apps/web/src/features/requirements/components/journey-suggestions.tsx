/**
 * 用户旅程建议组件
 */

'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
} from '@xpm/ui';
import { cn } from '@/lib/utils';
import {
  Map,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Users,
  ListTodo,
  Plus,
} from 'lucide-react';
import type { JourneySuggestion } from '../types';

const priorityColors: Record<string, string> = {
  high: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30',
  medium: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30',
  low: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30',
};

const priorityLabels: Record<string, string> = { high: '高', medium: '中', low: '低' };

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
        'border rounded-lg overflow-hidden transition-colors',
        suggestion.adopted
          ? 'border-primary/50 bg-primary/5'
          : 'bg-card hover:border-border/80'
      )}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`journey-${suggestion.id}`}
            checked={suggestion.adopted}
            onCheckedChange={() => onToggle(suggestion.id)}
            className="mt-0.5"
          />

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <label
                htmlFor={`journey-${suggestion.id}`}
                className="text-sm font-medium cursor-pointer leading-snug"
              >
                {suggestion.name}
              </label>
              <Badge
                variant="outline"
                className={cn('text-[10px] px-1.5 shrink-0', priorityColors[suggestion.priority])}
              >
                {priorityLabels[suggestion.priority] ?? suggestion.priority}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {suggestion.description}
            </p>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {suggestion.persona}
              </div>
              <div className="flex items-center gap-1">
                <ListTodo className="h-3 w-3" />
                {suggestion.stepCount} 步骤
              </div>
              <div className="flex items-center gap-1">
                <Map className="h-3 w-3" />
                {suggestion.suggestedStories.length} 故事
              </div>
            </div>

            {suggestion.suggestedStories.length > 0 && (
              <>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {isExpanded ? (
                    <><ChevronUp className="h-3 w-3" />收起故事列表</>
                  ) : (
                    <><ChevronDown className="h-3 w-3" />查看故事 ({suggestion.suggestedStories.length})</>
                  )}
                </button>

                {isExpanded && (
                  <ul className="space-y-1 pl-1">
                    {suggestion.suggestedStories.map((story, i) => (
                      <li
                        key={i}
                        className="text-xs p-1.5 rounded bg-muted/60 text-muted-foreground"
                      >
                        {story}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {suggestion.adopted && (
            <Button
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => onApply(suggestion.id)}
              disabled={isProcessing}
            >
              <Plus className="h-3 w-3 mr-1" />
              添加
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface JourneySuggestionsProps {
  suggestions: JourneySuggestion[];
  onToggleAdopt: (id: string) => void;
  onApply: (id: string) => void;
  onApplyAll?: () => void;
  isProcessing: boolean;
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
  const adoptedCount = suggestions.filter((s) => s.adopted).length;

  if (suggestions.length === 0) return null;

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Map className="h-4 w-4 text-primary" />
              旅程建议
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              已选 {adoptedCount} / {suggestions.length}
            </CardDescription>
          </div>

          {adoptedCount > 0 && (
            <Button
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={onApplyAll}
              disabled={isProcessing}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              批量添加到项目
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {suggestions.map((suggestion) => (
          <JourneySuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onToggle={onToggleAdopt}
            onApply={onApply}
            isProcessing={isProcessing}
          />
        ))}
      </CardContent>
    </Card>
  );
}
