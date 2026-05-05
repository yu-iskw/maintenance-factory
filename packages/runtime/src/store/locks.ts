import type { PoolClient } from 'pg';

export interface AcquireLockParams {
  key: string;
  repoFullName: string;
  githubProjectItemId: string;
  ttlSeconds: number;
}

/**
 * Try to acquire an exclusive scheduler lock. Returns true if acquired.
 */
export async function tryAcquireSchedulerLock(
  client: PoolClient,
  params: AcquireLockParams,
): Promise<boolean> {
  await client.query(`DELETE FROM scheduler_locks WHERE expires_at < now()`);
  const result = await client.query(
    `INSERT INTO scheduler_locks (key, repo_full_name, github_project_item_id, expires_at)
     VALUES ($1, $2, $3, now() + $4::int * interval '1 second')
     ON CONFLICT (key) DO NOTHING
     RETURNING key`,
    [params.key, params.repoFullName, params.githubProjectItemId, params.ttlSeconds],
  );
  return result.rowCount === 1;
}

export async function releaseSchedulerLock(client: PoolClient, key: string): Promise<void> {
  await client.query(`DELETE FROM scheduler_locks WHERE key = $1`, [key]);
}
