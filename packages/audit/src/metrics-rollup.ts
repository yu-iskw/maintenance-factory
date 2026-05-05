import { agentRuns, upsertDailyMetric } from '@maintenance-factory/db';
import { and, count, gte, lt, sql } from 'drizzle-orm';

import type { Db } from '@maintenance-factory/db';

export async function rollupDailyMetrics(db: Db, date: Date): Promise<void> {
  const day = date.toISOString().slice(0, 10);
  const dayStart = new Date(`${day}T00:00:00Z`);
  const dayEnd = new Date(`${day}T23:59:59Z`);

  const [counts] = await db
    .select({
      total: count(),
      successCount: sql<number>`count(*) filter (where ${agentRuns.status} = 'SUCCESS')::int`,
      failureCount: sql<number>`count(*) filter (where ${agentRuns.status} = 'FAILED')::int`,
    })
    .from(agentRuns)
    .where(and(gte(agentRuns.startedAt, dayStart), lt(agentRuns.startedAt, dayEnd)));

  await upsertDailyMetric(db, {
    day,
    agentRunCount: counts?.total ?? 0,
    agentSuccessCount: counts?.successCount ?? 0,
    agentFailureCount: counts?.failureCount ?? 0,
    openCount: 0,
    mergedCount: 0,
    blockedCount: 0,
  });
}
