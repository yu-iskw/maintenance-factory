import type { PoolClient } from 'pg';

/** RFC §15.2 — embedded so dist/ does not require copying .sql files. */
export const INIT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS agent_runs (
  id bigserial PRIMARY KEY,
  run_uuid uuid NOT NULL UNIQUE,
  github_project_item_id text NOT NULL,
  repo_full_name text NOT NULL,
  task_type text NOT NULL,
  severity text,
  risk text NOT NULL,
  repo_criticality text NOT NULL,
  policy_decision text NOT NULL,
  policy_reason text,
  prompt_template_version text NOT NULL,
  cursor_run_id text,
  branch_name text,
  pr_url text,
  status text NOT NULL,
  files_changed_summary text,
  validation_commands text[] NOT NULL DEFAULT '{}',
  validation_summary text,
  check_summary text,
  reviewer_outcome text,
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repo_profiles (
  repo_full_name text PRIMARY KEY,
  owner_team text,
  codeowners_present boolean,
  default_branch text,
  primary_language text,
  package_managers text[] NOT NULL DEFAULT '{}',
  repo_criticality text NOT NULL DEFAULT 'standard',
  test_commands text[] NOT NULL DEFAULT '{}',
  build_commands text[] NOT NULL DEFAULT '{}',
  forbidden_paths text[] NOT NULL DEFAULT '{}',
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduler_locks (
  key text PRIMARY KEY,
  repo_full_name text,
  github_project_item_id text,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS policy_decisions (
  id bigserial PRIMARY KEY,
  github_project_item_id text NOT NULL,
  repo_full_name text NOT NULL,
  task_type text NOT NULL,
  decision text NOT NULL,
  reason text,
  policy_version text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metrics_daily (
  day date NOT NULL,
  owner_team text NOT NULL DEFAULT '',
  repo_criticality text NOT NULL DEFAULT '',
  task_type text NOT NULL DEFAULT '',
  open_count int NOT NULL DEFAULT 0,
  merged_count int NOT NULL DEFAULT 0,
  blocked_count int NOT NULL DEFAULT 0,
  agent_run_count int NOT NULL DEFAULT 0,
  agent_success_count int NOT NULL DEFAULT 0,
  agent_failure_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (day, owner_team, repo_criticality, task_type)
);

CREATE TABLE IF NOT EXISTS kill_switches (
  id serial PRIMARY KEY,
  scope text NOT NULL,
  scope_key text NOT NULL DEFAULT '',
  paused boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, scope_key)
);
`;

/**
 * Split SQL on `;` after trim. Intended for simple DDL blobs only: do not embed `;` inside
 * string literals or identifiers, or statements will fragment incorrectly.
 */
export function splitSchemaStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function runMigrations(client: PoolClient): Promise<void> {
  for (const statement of splitSchemaStatements(INIT_SCHEMA_SQL)) {
    await client.query(statement);
  }
}
