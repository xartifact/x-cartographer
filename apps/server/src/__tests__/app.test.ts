import { describe, expect, it } from 'bun:test';
import { createApp } from '../index';

describe('gateway', () => {
  it('GET /health returns ok', async () => {
    const app = createApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('404 on unknown route', async () => {
    const app = createApp();
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
  });
});
