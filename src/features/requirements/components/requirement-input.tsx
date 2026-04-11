/**
 * 需求输入组件
 */

'use client';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Save, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDraftAutosave } from '../hooks/use-draft-autosave';

interface RequirementInputProps {
  projectId: string;
  value: string;
  onChange: (value: string) => void;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  error: string | null;
  className?: string;
}

const MIN_LENGTH = 10;

export function RequirementInput({
  projectId,
  value,
  onChange,
  isAnalyzing,
  onAnalyze,
  error,
  className,
}: RequirementInputProps) {
  const { lastSavedTime, clearDraft } = useDraftAutosave(projectId);

  const charCount = value.length;
  const tooShort = value.trim().length > 0 && value.trim().length < MIN_LENGTH;

  return (
    <Card className={cn('flex flex-col min-h-0', className)}>
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">需求描述</CardTitle>
          <div className="flex items-center gap-2">
            {lastSavedTime && (
              <Badge variant="outline" className="text-xs font-normal">
                <Save className="h-3 w-3 mr-1" />
                已自动保存
              </Badge>
            )}
            {value && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => { onChange(''); clearDraft(); }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                清空
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 gap-3 pt-0">
        {/* 文本输入区 */}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`输入产品需求描述，支持 Markdown 格式。

例如：
- 用户角色及其目标
- 核心功能需求
- 业务流程说明
- 预期使用场景

需求越详细，分析结果越准确。`}
          className="flex-1 resize-none text-sm leading-relaxed min-h-[200px]"
        />

        {/* 状态行 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <span>{charCount > 0 ? `${charCount} 字符` : ''}</span>
          {tooShort && (
            <span className="text-amber-500">至少输入 {MIN_LENGTH} 个字符</span>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md shrink-0">
            {error}
          </div>
        )}

        {/* 分析按钮 */}
        <Button
          onClick={onAnalyze}
          disabled={isAnalyzing || !value.trim() || tooShort}
          className="w-full shrink-0"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              分析中...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              AI 分析需求
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
