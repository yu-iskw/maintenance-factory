import { sql } from 'drizzle-orm';

import type { Db } from '../client';
import { metricsDaily } from '../schema';
import type { MetricsDailyRow, NewMetricsDailyRow } from '../schema/metrics-daily';

export async function upsertDailyMetric(
  db: Db,
  metric: NewMetricsDailyRow,
): Promise<MetricsDailyRow> {
  const [upserted] = await db
    .insert(metricsDaily)
    .values(metric)
    .onConflictDoUpdate({
      target: [metricsDaily.day, metricsDaily.ownerTeam, metricsDaily.repoCriticality, metricsDaily.taskType],
      set: {
        openCount: metric.openCount ?? 0,
        mergedCount: metric.mergedCount ?? 0,
        blockedCount: metric.blockedCount ?? 0,
        agentRunCount: sql`${metricsDaily.agentRunCount} + ${metric.agentRunCount ?? 0}`,
        agentSuccessCount: sql`${metricsDaily.agentSuccessCount} + ${metric.agentSuccessCount ?? 0}`,
        agentFailureCount: sql`${metricsDaily.agentFailureCount} + ${metric.agentFailureCount ?? 0}`,
      },
    })
    .returning();
  if (!upserted) throw new Error('Failed to upsert daily metric');
  return upserted;
}
