// Settings REST routes
// 来源: settings.actions.ts (Server Actions) → Hono

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppSettingsRepository } from '@xpm/db';
import { LLMProvider } from '@xpm/shared';
import { getProviderConfig, testConnection } from '../lib/llm';

const providerSchema = z.nativeEnum(LLMProvider);

const saveKeySchema = z.object({
  apiKey: z.string(),
  baseURL: z.string().optional(),
  model: z.string().optional(),
});

const testSchema = z.object({
  model: z.string().optional(),
});

const repo = new AppSettingsRepository();

function providerKey(provider: LLMProvider) {
  return `llm_api_key_${provider}`;
}
function baseURLKey(provider: LLMProvider) {
  return `llm_base_url_${provider}`;
}
function modelKey(provider: LLMProvider) {
  return `llm_model_${provider}`;
}

export const settingsRoutes = new Hono()
  // PUT /api/settings/llm/:provider
  .put('/llm/:provider', zValidator('json', saveKeySchema), async (c) => {
    const provider = providerSchema.parse(c.req.param('provider'));
    const input = c.req.valid('json');

    await repo.set(providerKey(provider), input.apiKey);
    if (input.baseURL) {
      await repo.set(baseURLKey(provider), input.baseURL);
    } else {
      await repo.delete(baseURLKey(provider));
    }
    if (input.model) {
      await repo.set(modelKey(provider), input.model);
    } else {
      await repo.delete(modelKey(provider));
    }
    return c.json({ success: true });
  })
  // DELETE /api/settings/llm/:provider
  .delete('/llm/:provider', async (c) => {
    const provider = providerSchema.parse(c.req.param('provider'));
    await repo.delete(providerKey(provider));
    await repo.delete(baseURLKey(provider));
    await repo.delete(modelKey(provider));
    return c.json({ success: true });
  })
  // GET /api/settings/llm/status
  .get('/llm/status', async (c) => {
    const result = {} as Record<
      LLMProvider,
      { configured: boolean; baseURL?: string; model?: string }
    >;
    for (const provider of Object.values(LLMProvider)) {
      const key = await repo.get(providerKey(provider));
      const baseURL = await repo.get(baseURLKey(provider));
      const model = await repo.get(modelKey(provider));
      result[provider] = {
        configured: !!key,
        ...(baseURL ? { baseURL } : {}),
        ...(model ? { model } : {}),
      };
    }
    return c.json(result);
  })
  // POST /api/settings/llm/:provider/test
  .post('/llm/:provider/test', async (c) => {
    const provider = providerSchema.parse(c.req.param('provider'));
    const body = await c.req.json().catch(() => ({}));
    const input = testSchema.parse(body);

    try {
      const config = await getProviderConfig(provider);
      return c.json(await testConnection(config, input.model));
    } catch (err) {
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : '连接失败',
      });
    }
  });
