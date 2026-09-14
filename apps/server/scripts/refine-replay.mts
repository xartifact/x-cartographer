import { sql } from 'drizzle-orm';
import { ensureDb, type DbInstance } from '@x-cartographer/db';

let db: DbInstance;
process.env.XPR_DB_DIR =
  '/Users/binzhan/Workspaces/github/xartifact/x-cartographer/apps/server/data/pglite';
db = await ensureDb();

const MAP: Array<[string, string]> = [
  ['US-019', 'UT-69h-204'],
  ['US-020', 'UT-69h-204'],
  ['US-035', 'UT-69h-403'],
  ['US-038', 'UT-69h-402'],
  ['kvkwxNnouah8rXMMwUReZ', 'UT-69h-503'],
  ['WR9VCoKVmgBuGMqBztJV-', 'UT-69h-502'],
  ['zK1JY2M7UesSoRCqGjypU', 'UT-69h-503'],
];
for (const [sid, ut] of MAP) {
  await db.execute(
    sql.raw(`UPDATE user_stories SET user_task_id='${ut}' WHERE id='${sid}'`)
  );
}
const chk: any = await db.execute(
  sql.raw(`SELECT count(*)::int AS n FROM user_stories WHERE user_task_id IS NOT NULL`)
);
console.log('REFINED:', chk.rows[0].n);
process.exit(0);
