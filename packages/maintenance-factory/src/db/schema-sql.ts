/** Embedded DDL for `migrate` CLI (avoids copying .sql next to dist). */
export const SCHEMA_SQL = `-- Maintenance factory audit and operational tables (RFC §15.2 + kill switches).

create table if not exists agent_runs (
  id bigserial primary key,
  run_uuid uuid not null unique,
  github_project_item_id text,
  repo_full_name text not null,
  owner_team text,
  task_type text not null,
  severity text,
  risk text not null,
  repo_criticality text not null,
  policy_decision text not null,
  policy_reason text,
  prompt_template_version text not null,
  cursor_run_id text,
  branch_name text,
  pr_url text,
  status text not null,
  files_changed_summary text,
  validation_commands text[],
  validation_summary text,
  check_summary text,
  reviewer_outcome text,
  error_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists agent_runs_repo_started_idx on agent_runs (repo_full_name, started_at desc);

create table if not exists repo_profiles (
  repo_full_name text primary key,
  owner_team text,
  codeowners_present boolean,
  default_branch text,
  primary_language text,
  package_managers text[],
  repo_criticality text not null default 'standard',
  test_commands text[],
  build_commands text[],
  forbidden_paths text[],
  notes text,
  updated_at timestamptz default now()
);

create table if not exists scheduler_locks (
  key text primary key,
  repo_full_name text,
  github_project_item_id text,
  acquired_at timestamptz default now(),
  expires_at timestamptz not null
);

create table if not exists policy_decisions (
  id bigserial primary key,
  github_project_item_id text,
  repo_full_name text not null,
  task_type text not null,
  decision text not null,
  reason text,
  policy_version text not null,
  evaluated_at timestamptz default now()
);

create index if not exists policy_decisions_item_idx on policy_decisions (github_project_item_id, evaluated_at desc);

create table if not exists metrics_daily (
  day date not null,
  owner_team text,
  repo_criticality text,
  task_type text,
  open_count int not null default 0,
  merged_count int not null default 0,
  blocked_count int not null default 0,
  agent_run_count int not null default 0,
  agent_success_count int not null default 0,
  agent_failure_count int not null default 0,
  primary key (day, owner_team, repo_criticality, task_type)
);

create table if not exists kill_switches (
  scope text primary key,
  paused boolean not null default false,
  updated_at timestamptz default now()
);

insert into kill_switches (scope, paused)
values ('global', false)
on conflict (scope) do nothing;

create table if not exists projects_v2_config (
  project_node_id text primary key,
  field_ids jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists project_item_index (
  idempotency_key text primary key,
  project_node_id text not null,
  project_item_id text not null,
  repo_full_name text not null,
  task_type text not null,
  external_id text,
  title text,
  updated_at timestamptz default now()
);

create index if not exists project_item_index_repo_idx on project_item_index (repo_full_name);

create table if not exists hermes_weekly_plans (
  id bigserial primary key,
  week_start date not null,
  body_markdown text not null,
  created_at timestamptz default now()
);

create index if not exists hermes_weekly_plans_week_idx on hermes_weekly_plans (week_start desc);

create table if not exists failure_signatures (
  signature text primary key,
  count int not null default 0,
  last_seen_at timestamptz default now(),
  example_repo text,
  example_task_type text
);
`;
