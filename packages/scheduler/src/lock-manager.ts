import * as os from 'node:os';

import type { Db } from '@maintenance-factory/db';
import { acquireLock, cleanExpiredLocks, releaseLock } from '@maintenance-factory/db';

export function buildLockKey(repoFullName: string, taskType: string, compositeKey: string): string {
  return `run:${repoFullName}:${taskType}:${compositeKey}`;
}

export async function tryAcquireLock(
  db: Db,
  lockKey: string,
  repoFullName: string,
  projectItemId: string,
  ttlHours: number,
): Promise<boolean> {
  const acquiredBy = `${os.hostname()}:${process.pid}`;
  return acquireLock(db, lockKey, repoFullName, projectItemId, acquiredBy, ttlHours);
}

export async function releaseLockByKey(db: Db, lockKey: string): Promise<void> {
  return releaseLock(db, lockKey);
}

export async function cleanStaleLocks(db: Db): Promise<number> {
  return cleanExpiredLocks(db);
}
