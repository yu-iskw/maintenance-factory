import { eq, lt } from 'drizzle-orm';

import { schedulerLocks } from '../schema';

import type { Db } from '../client';
import type { SchedulerLockRow } from '../schema/scheduler-locks';

export async function acquireLock(
  db: Db,
  lockKey: string,
  repoFullName: string,
  projectItemId: string,
  acquiredBy: string,
  ttlHours: number,
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const result = await db
    .insert(schedulerLocks)
    .values({ lockKey, repoFullName, projectItemId, acquiredBy, expiresAt })
    .onConflictDoNothing()
    .returning();
  return result.length > 0;
}

export async function releaseLock(db: Db, lockKey: string): Promise<void> {
  await db.delete(schedulerLocks).where(eq(schedulerLocks.lockKey, lockKey));
}

export async function getLock(db: Db, lockKey: string): Promise<SchedulerLockRow | undefined> {
  return db.query.schedulerLocks.findFirst({
    where: eq(schedulerLocks.lockKey, lockKey),
  });
}

export async function cleanExpiredLocks(db: Db): Promise<number> {
  const result = await db
    .delete(schedulerLocks)
    .where(lt(schedulerLocks.expiresAt, new Date()))
    .returning();
  return result.length;
}
