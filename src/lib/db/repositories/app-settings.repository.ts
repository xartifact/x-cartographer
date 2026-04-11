import { eq } from 'drizzle-orm';
import { ensureDb } from '../client';
import { appSettings } from '../schema/app-settings';

export class AppSettingsRepository {
  async get(key: string): Promise<string | null> {
    const db = await ensureDb();
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, key),
    });
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const db = await ensureDb();
    await db
      .insert(appSettings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  async delete(key: string): Promise<void> {
    const db = await ensureDb();
    await db.delete(appSettings).where(eq(appSettings.key, key));
  }
}
