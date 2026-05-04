import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const repoProfiles = pgTable('repo_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  repoFullName: text('repo_full_name').notNull().unique(),
  ownerTeam: text('owner_team'),
  repoCriticality: text('repo_criticality', {
    enum: ['standard', 'sensitive', 'critical'],
  })
    .notNull()
    .default('standard'),
  primaryLanguage: text('primary_language'),
  packageManagers: text('package_managers').array(),
  defaultBranch: text('default_branch').notNull().default('main'),
  codeownersPresent: boolean('codeowners_present').default(false),
  testCommands: text('test_commands').array(),
  buildCommands: text('build_commands').array(),
  forbiddenPaths: text('forbidden_paths').array(),
  runtimeJson: jsonb('runtime_json'),
  notes: text('notes'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type RepoProfileRow = typeof repoProfiles.$inferSelect;
export type NewRepoProfileRow = typeof repoProfiles.$inferInsert;
