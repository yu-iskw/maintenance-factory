import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const schedulerLocks = pgTable('scheduler_locks', {
  lockKey: text('lock_key').primaryKey(),
  repoFullName: text('repo_full_name').notNull(),
  projectItemId: text('project_item_id').notNull(),
  acquiredBy: text('acquired_by').notNull(),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export type SchedulerLockRow = typeof schedulerLocks.$inferSelect;
export type NewSchedulerLockRow = typeof schedulerLocks.$inferInsert;
