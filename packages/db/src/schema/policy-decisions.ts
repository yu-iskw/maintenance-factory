import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const policyDecisions = pgTable('policy_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectItemId: text('project_item_id').notNull(),
  repoFullName: text('repo_full_name').notNull(),
  taskType: text('task_type').notNull(),
  compositeKey: text('composite_key').notNull(),
  allowed: boolean('allowed').notNull(),
  reason: text('reason').notNull(),
  blockedBy: text('blocked_by'),
  policyVersion: text('policy_version').notNull(),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PolicyDecisionRow = typeof policyDecisions.$inferSelect;
export type NewPolicyDecisionRow = typeof policyDecisions.$inferInsert;
