import type { Db } from '@maintenance-factory/db';
import { upsertDailyMetric } from '@maintenance-factory/db';

export async function rollupDailyMetrics(db: Db, date: Date): Promise<void> {
  const day = date.toISOString().slice(0, 10);

  // Count successful and failed runs for the day
  const runs = await db.query.agentRuns.findMany({
    where: (t, { gte, and, lt }) =>
      and(
        gte(t.startedAt, new Date(`${day}T00:00:00Z`)),
        lt(t.startedAt, new Date(`${day}T23:59:59Z`)),
      ),
  });

  const successCount = runs.filter((r) => r.status === 'SUCCESS').length;
  const failureCount = runs.filter((r) => r.status === 'FAILED').length;

  await upsertDailyMetric(db, {
    day,
    agentRunCount: runs.length,
    agentSuccessCount: successCount,
    agentFailureCount: failureCount,
    openCount: 0,
    mergedCount: 0,
    blockedCount: 0,
  });
}
