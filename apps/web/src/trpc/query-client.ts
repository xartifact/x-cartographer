import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 默认 30 秒内不会重新请求
        staleTime: 30 * 1000,
      },
      dehydrate: {
        // 包括 pending 状态的 query，用于 SSR hydration
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  });
}
