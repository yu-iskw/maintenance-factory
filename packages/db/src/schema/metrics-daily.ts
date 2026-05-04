import { date, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

export const metricsDaily = pgTable(
  'metrics_daily',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    day: date('day').notNull(),
    ownerTeam: text('owner_team'),
    repoCriticality: text('repo_criticality'),
    taskType: text('task_type'),
    openCount: integer('open_count').notNull().default(0),
    mergedCount: integer('merged_count').notNull().default(0),
    blockedCount: integer('blocked_count').notNull().default(0),
    agentRunCount: integer('agent_run_count').notNull().default(0),
    agentSuccessCount: integer('agent_success_count').notNull().default(0),
    agentFailureCount: integer('agent_failure_count').notNull().default(0),
  },
  (t) => [unique().on(t.day, t.ownerTeam, t.repoCriticality, t.taskType)],
);

export type MetricsDailyRow = typeof metricsDaily.$inferSelect;
export type NewMetricsDailyRow = typeof metricsDaily.$inferInsert;
