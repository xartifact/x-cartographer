/**
 * Markdown 预览组件
 *
 * 注意：当前版本使用简单的 pre 标签渲染
 * 未来可以集成 react-markdown 实现完整的 Markdown 渲染
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MarkdownPreviewProps {
  /** Markdown 内容 */
  content: string;

  /** 类名 */
  className?: string;
}

/**
 * Markdown 预览组件
 */
export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Markdown 预览</CardTitle>
      </CardHeader>

      <CardContent>
        <div
          className="prose prose-sm max-w-none dark:prose-invert
                     p-4 border rounded-md bg-muted/30 min-h-[400px]
                     prose-headings:mt-0 prose-headings:mb-2
                     prose-p:my-2 prose-p:leading-relaxed
                     prose-ul:my-2 prose-ol:my-2
                     prose-li:my-0.5"
        >
          {content ? (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          ) : (
            <p className="text-muted-foreground">暂无内容</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 简单的 Markdown 渲染函数
 * 仅支持基础格式
 */
function renderMarkdown(text: string): string {
  if (!text) return '';

  let html = text;

  // 转义 HTML（防止 XSS）
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    return `<pre class="bg-muted p-3 rounded-md overflow-x-auto"><code>${code.trim()}</code></pre>`;
  });

  // 行内代码
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    return `<code class="bg-muted px-1 py-0.5 rounded text-sm">${code}</code>`;
  });

  // 粗体
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // 斜体
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 删除线
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>');

  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-5 mb-3">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');

  // 水平线
  html = html.replace(/^---$/gm, '<hr class="my-6 border-t" />');

  // 无序列表
  html = html.replace(/^[-*] (.+)$/gm, '<li class="ml-4">$1</li>');
  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');

  // 段落（由空行分隔）
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs
    .map((p) => {
      // 如果是列表项，不包裹 p 标签
      if (p.startsWith('<li') || p.startsWith('<h') || p.startsWith('<hr') || p.startsWith('<pre')) {
        return p;
      }
      return `<p class="my-2">${p}</p>`;
    })
    .join('');

  // 清理多余的换行
  html = html.replace(/\n/g, '<br />');

  return html;
}