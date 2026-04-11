/**
 * 需求输入组件
 */

'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Save, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDraftAutosave } from '../hooks/use-draft-autosave';

interface RequirementInputProps {
  /** 项目 ID */
  projectId: string;

  /** 输入文本 */
  value: string;

  /** 输入变化回调 */
  onChange: (value: string) => void;

  /** 是否正在分析 */
  isAnalyzing: boolean;

  /** 分析回调 */
  onAnalyze: () => void;

  /** 错误信息 */
  error: string | null;

  /** 类名 */
  className?: string;
}

/**
 * 优先级徽章变体
 */
const priorityVariants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
} as const;

export function RequirementInput({
  projectId,
  value,
  onChange,
  isAnalyzing,
  onAnalyze,
  error,
  className,
}: RequirementInputProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const { lastSavedTime, clearDraft } = useDraftAutosave(projectId);

  const handleClear = () => {
    onChange('');
    clearDraft();
  };

  const MIN_LENGTH = 10;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;
  const tooShort = value.trim().length > 0 && value.trim().length < MIN_LENGTH;

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">需求输入</CardTitle>
          <div className="flex items-center gap-2">
            {lastSavedTime && (
              <Badge variant="outline" className="text-xs">
                <Save className="h-3 w-3 mr-1" />
                已保存
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 输入模式切换 */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button
              variant={!isPreviewMode ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIsPreviewMode(false)}
            >
              编辑
            </Button>
            <Button
              variant={isPreviewMode ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIsPreviewMode(true)}
            >
              预览
            </Button>
          </div>

          {value && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <RotateCcw className="h-4 w-4 mr-1" />
              清空
            </Button>
          )}
        </div>

        {/* 输入/预览区域 */}
        <div className="min-h-[300px]">
          {isPreviewMode ? (
            <div className="prose prose-sm max-w-none dark:prose-invert p-4 border rounded-md bg-muted/30 min-h-[300px]">
              {value ? (
                <pre className="whitespace-pre-wrap font-sans">{value}</pre>
              ) : (
                <p className="text-muted-foreground">暂无内容，输入需求文本后将显示预览</p>
              )}
            </div>
          ) : (
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="请在此输入产品需求描述...

支持 Markdown 格式，例如：
- 用户角色描述
- 功能需求列表
- 业务流程说明
- 预期用户场景

提示：越详细的需求描述，分析结果越准确。"
              className="min-h-[300px] resize-none font-mono text-sm"
            />
          )}
        </div>

        {/* 字数统计 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex gap-4">
            <span>字数: {wordCount}</span>
            <span>字符: {charCount}</span>
          </div>
          {tooShort && (
            <span className="text-orange-500">至少输入 {MIN_LENGTH} 个字符</span>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onAnalyze}
            disabled={isAnalyzing || !value.trim() || tooShort}
            className="flex-1"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                分析需求
              </>
            )}
          </Button>
        </div>

        {/* 提示信息 */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>提示：</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>使用 Markdown 格式可以更好地组织内容</li>
            <li>草稿会自动保存到本地</li>
            <li>建议包含用户角色、功能需求、业务流程等信息</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}