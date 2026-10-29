/** Current execution claim; historical tasks are intentionally not backfilled. */
export const AGENT_CLAIM_DDL = [
  `ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS claim_agent_id text`,
  `ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS claim_session_id text`,
  `ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone`,
  `CREATE INDEX IF NOT EXISTS dev_tasks_active_claim_idx ON dev_tasks (claim_agent_id, claim_session_id, claimed_at) WHERE status = 'in_progress' AND claim_agent_id IS NOT NULL AND claim_session_id IS NOT NULL AND claimed_at IS NOT NULL`,
];
