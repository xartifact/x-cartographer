import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { routeTree } from './routeTree';
import { ErrorBoundary } from './components/common/error-boundary';
import './styles/globals.css';

// QueryClient 配置（对齐原 query-client.ts：30s staleTime）
// 全局错误处理：查询失败时输出可读错误信息（TASK-088）
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
    mutations: {
      onError: (error) => {
        const message =
          error instanceof Error ? error.message : '请求失败，请稍后重试';
        console.error('[Query] mutation error:', message);
      },
    },
  },
});

// Router 上下文注入 QueryClient
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root')!;

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);