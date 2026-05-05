import type { PoolClient } from 'pg';

export interface MetricsDailyRow {
  /** ISO date `YYYY-MM-DD` */
  day: string;
  ownerTeam: string;
  repoCriticality: string;
  taskType: string;
  openCount: number;
  mergedCount: number;
  blockedCount: number;
  agentRunCount: number;
  agentSuccessCount: number;
  agentFailureCount: number;
}

/** Upsert one `metrics_daily` row (RFC §15.2 / §17 daily rollup). */
export async function upsertMetricsDaily(client: PoolClient, row: MetricsDailyRow): Promise<void> {
  await client.query(
    `INSERT INTO metrics_daily (
       day, owner_team, repo_criticality, task_type,
       open_count, merged_count, blocked_count,
       agent_run_count, agent_success_count, agent_failure_count
     ) VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (day, owner_team, repo_criticality, task_type)
     DO UPDATE SET
       open_count = EXCLUDED.open_count,
       merged_count = EXCLUDED.merged_count,
       blocked_count = EXCLUDED.blocked_count,
       agent_run_count = EXCLUDED.agent_run_count,
       agent_success_count = EXCLUDED.agent_success_count,
       agent_failure_count = EXCLUDED.agent_failure_count`,
    [
      row.day,
      row.ownerTeam,
      row.repoCriticality,
      row.taskType,
      row.openCount,
      row.mergedCount,
      row.blockedCount,
      row.agentRunCount,
      row.agentSuccessCount,
      row.agentFailureCount,
    ],
  );
}
