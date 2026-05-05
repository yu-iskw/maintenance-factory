import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectItemId: text('project_item_id').notNull(),
  repoFullName: text('repo_full_name').notNull(),
  taskType: text('task_type').notNull(),
  compositeKey: text('composite_key').notNull().unique(),
  backend: text('backend', { enum: ['cursor', 'copilot'] }).notNull(),
  status: text('status', {
    enum: ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'],
  }).notNull(),
  triggerSource: text('trigger_source', {
    enum: ['scheduler', 'webhook', 'manual'],
  }).notNull(),
  promptTemplateVersion: text('prompt_template_version').notNull(),
  branchName: text('branch_name'),
  prUrl: text('pr_url'),
  prNumber: integer('pr_number'),
  filesChangedSummary: text('files_changed_summary'),
  validationSummary: text('validation_summary'),
  checkSummary: text('check_summary'),
  reviewerOutcome: text('reviewer_outcome'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AgentRunRow = typeof agentRuns.$inferSelect;
export type NewAgentRunRow = typeof agentRuns.$inferInsert;
