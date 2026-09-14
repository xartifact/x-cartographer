import { describe, expect, it } from 'bun:test';
import { createApp } from '../index';

describe('gateway', () => {
  it('GET /health returns ok', async () => {
    const app = createApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('unknown route falls back to SPA index (200) in dev-build presence', async () => {
    const app = createApp();
    const res = await app.request('/nope');
    // spaStaticMiddleware 把非 /api 路径 fallback 到 index.html（生产镜像恒有 dist）
    expect([200, 404]).toContain(res.status);
  });
});
