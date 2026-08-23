'use client';

/**
 * 错误边界组件（TASK-088）
 *
 * 捕获 React 渲染错误并展示友好提示，提供重试入口。
 * 同时为 QueryClient 提供全局 onError 处理（见 main.tsx 装配）。
 */

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@x-cartographer/ui';

interface ErrorBoundaryProps {
  /** 可选的错误展示标题 */
  title?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 上报控制台，便于排查（可在此接入外部监控）
    console.error('[ErrorBoundary] caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const message =
        this.state.error instanceof Error
          ? this.state.error.message
          : String(this.state.error ?? '未知错误');
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold">
              {this.props.title ?? '页面出错了'}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              遇到一个意外错误。你可以重试，或返回上一页。
            </p>
          </div>
          <div className="max-w-md truncate rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            {message}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.history.back()}>
              返回上一页
            </Button>
            <Button onClick={this.handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重试
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}