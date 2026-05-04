import { readFileSync } from 'node:fs';

import { parse } from 'yaml';

import type { RepoCriticality, RiskLevel, TaskType } from '../types/domain.js';

export type PolicyGlobal = {
  never_auto_merge: boolean;
  max_global_concurrent_runs: number;
  max_runs_per_repo: number;
  max_runs_per_owner_team: number;
  max_daily_runs: number;
  retry_limit_per_task: number;
  max_critical_repo_runs?: number;
};

export type RepoCriticalityPolicy = {
  scheduled_runs: boolean;
  max_concurrent_runs?: number;
  required_reviews: string[];
};

export type TaskPolicyEntry = {
  allowed_risk?: RiskLevel[];
  max_retries?: number;
  require_advisory_reference?: boolean;
  allowed_scopes?: string[];
};

export type PolicyDocument = {
  version: number;
  global: PolicyGlobal;
  allowed_task_types: TaskType[];
  forbidden_paths: string[];
  repo_criticality: Record<RepoCriticality, RepoCriticalityPolicy>;
  task_policies: Partial<Record<TaskType, TaskPolicyEntry>>;
};

export function loadPolicyFromYamlFile(path: string): PolicyDocument {
  // Path is supplied by operator/CLI, not end-user web input.
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- intentional configurable policy path
  const raw = readFileSync(path, 'utf8');
  const parsed = parse(raw) as PolicyDocument;
  if (parsed.version !== 1) {
    throw new Error(`Unsupported policy version: ${String(parsed.version)}`);
  }
  return parsed;
}
