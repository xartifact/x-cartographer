import { Outlet } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout';

// Router context 携带 QueryClient，供 route 内 useQuery 使用
export interface RouterContext {
  queryClient: QueryClient;
}



export function RootComponent() {
  return (
    <AppLayout showSidebar>
      <Outlet />
    </AppLayout>
  );
}
