'use client';

/**
 * Markdown 描述输入组件（TASK-019 Markdown 实时预览 + TASK-020 草稿自动保存）
 *
 * 提供：
 * - 编辑/预览 双栏切换（react-markdown 实时渲染）
 * - 草稿自动保存到 localStorage（按 draftKey 隔离），刷新/重开后恢复
 */

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Label, Textarea, Button } from '@x-cartographer/ui';
import { cn } from '@/lib/utils';

interface MarkdownFieldProps {
  /** 表单字段 id（用于 Label htmlFor） */
  id: string;
  /** 字段标签 */
  label: string;
  /** 是否必填 */
  required?: boolean;
  /** 占位提示 */
  placeholder?: string;
  /** 当前值（受控） */
  value: string;
  /** 值变更 */
  onChange: (value: string) => void;
  /** 草稿存储键（自动保存用）；传入则启用草稿恢复 */
  draftKey?: string;
  /** 草稿是否可恢复（默认 true） */
  restoreDraft?: boolean;
}

export function MarkdownField({
  id,
  label,
  required = false,
  placeholder,
  value,
  onChange,
  draftKey,
  restoreDraft = true,
}: MarkdownFieldProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [hasDraft, setHasDraft] = useState(false);
  const isFirstApply = useRef(true);

  // 草稿自动保存（TASK-020）：值变化时写入 localStorage
  useEffect(() => {
    if (!draftKey || !value) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`xcart-draft:${draftKey}`, value);
      } catch {
        // localStorage 不可用时静默降级
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [draftKey, value]);

  // 草稿恢复（挂载时检查一次）
  useEffect(() => {
    if (!draftKey || !restoreDraft || !isFirstApply.current) return;
    isFirstApply.current = false;
    try {
      const saved = localStorage.getItem(`xcart-draft:${draftKey}`);
      if (saved && !value) {
        setHasDraft(true);
        onChange(saved);
      }
    } catch {
      // localStorage 不可用时静默降级
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearDraft = () => {
    if (!draftKey) return;
    try {
      localStorage.removeItem(`xcart-draft:${draftKey}`);
    } catch {
      // 忽略
    }
    setHasDraft(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
        <div className="flex items-center gap-1">
          {hasDraft && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={clearDraft}
              title="清除已恢复的草稿"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              清除草稿
            </Button>
          )}
          <Button
            variant={mode === 'edit' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setMode('edit')}
          >
            <Pencil className="mr-1 h-3 w-3" />
            编辑
          </Button>
          <Button
            variant={mode === 'preview' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setMode('preview')}
          >
            <Eye className="mr-1 h-3 w-3" />
            预览
          </Button>
        </div>
      </div>

      {mode === 'edit' ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[100px] resize-y font-mono text-sm"
        />
      ) : (
        <div
          className={cn(
            'min-h-[100px] rounded-md border bg-background px-3 py-2 text-sm leading-relaxed',
            'prose prose-sm max-w-none dark:prose-invert'
          )}
        >
          {value ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <p className="py-4 text-center text-muted-foreground/60">
              暂无内容
            </p>
          )}
        </div>
      )}
    </div>
  );
}