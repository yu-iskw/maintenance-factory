import type { PoolClient } from 'pg';

export async function upsertKillSwitch(
  client: PoolClient,
  scope: string,
  scopeKey: string,
  paused: boolean,
): Promise<void> {
  await client.query(
    `INSERT INTO kill_switches (scope, scope_key, paused)
     VALUES ($1, $2, $3)
     ON CONFLICT (scope, scope_key) DO UPDATE SET paused = EXCLUDED.paused, updated_at = now()`,
    [scope, scopeKey, paused],
  );
}

export async function listKillSwitches(
  client: PoolClient,
): Promise<Array<{ scope: string; scope_key: string; paused: boolean }>> {
  const { rows } = await client.query(
    `SELECT scope, scope_key, paused FROM kill_switches ORDER BY scope, scope_key`,
  );
  return rows as Array<{ scope: string; scope_key: string; paused: boolean }>;
}
