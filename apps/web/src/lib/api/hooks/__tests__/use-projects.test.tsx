import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useProjects, useCreateProject } from '../use-projects';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const mockProjects = [
  {
    id: 'proj-1',
    name: 'X-Cartographer',
    description: '用户故事地图',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    user_journeys: [],
    metadata: { tech_stack: ['TypeScript'], version: '1.0', tags: [] },
    settings: {
      llm_provider: 'openai',
      auto_save: true,
      display_preferences: { show_priority_colors: true, show_estimation: true, default_view: 'map' as const },
    },
  },
];

describe('useProjects', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('成功时返回项目列表（GET /api/projects）', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockProjects,
    } as Response);

    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockProjects);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/projects');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('网络失败时进入 error 状态', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('network down');
  });
});

describe('useCreateProject', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('mutation 成功提交 POST /api/projects 并携带 JSON body', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true, id: 'new-proj-1' }),
    } as Response);

    const { result } = renderHook(() => useCreateProject(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ name: '新项目', description: '描述', tech_stack: ['TS'] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ success: true, id: 'new-proj-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/projects');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      name: '新项目',
      description: '描述',
      tech_stack: ['TS'],
    });
  });

  it('mutation 失败时进入 error 状态', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new Error('create failed'));

    const { result } = renderHook(() => useCreateProject(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ name: '新项目' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('create failed');
  });

  it("成功后使 ['projects'] 查询失效并触发重新拉取", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return { ok: true, status: 201, json: async () => ({ success: true, id: 'new-proj-1' }) } as Response;
      }
      return { ok: true, status: 200, json: async () => mockProjects } as Response;
    });

    const wrapper = createWrapper();
    const { result: projects } = renderHook(() => useProjects(), { wrapper });
    await waitFor(() => expect(projects.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { result: create } = renderHook(() => useCreateProject(), { wrapper });
    act(() => {
      create.current.mutate({ name: '新项目' });
    });
    await waitFor(() => expect(create.current.isSuccess).toBe(true));

    // onSuccess 使 ['projects'] 失效 → 活跃查询重新拉取
    await waitFor(() => {
      const getCalls = fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === 'GET');
      expect(getCalls).toHaveLength(2);
    });
  });
});
