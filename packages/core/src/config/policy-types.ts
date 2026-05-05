import type { MaintenanceTaskType, RepoCriticality, RiskLevel } from '../domain/types.js';

export interface PolicyGlobal {
  never_auto_merge: boolean;
  max_global_concurrent_runs: number;
  max_runs_per_repo: number;
  max_runs_per_owner_team: number;
  max_daily_runs: number;
  retry_limit_per_task: number;
}

export interface CriticalityPolicy {
  scheduled_runs: boolean;
  required_reviews: string[];
  max_concurrent_runs?: number;
}

export interface TaskPolicyRule {
  allowed_risk?: RiskLevel[];
  max_retries?: number;
  require_advisory_reference?: boolean;
  allowed_scopes?: string[];
}

export interface PolicyDocument {
  version: number;
  global: PolicyGlobal;
  allowed_task_types: MaintenanceTaskType[];
  forbidden_paths: string[];
  repo_criticality: Record<RepoCriticality, CriticalityPolicy>;
  task_policies: Partial<Record<MaintenanceTaskType, TaskPolicyRule>>;
}

export const defaultPolicyDocument: PolicyDocument = {
  version: 1,
  global: {
    never_auto_merge: true,
    max_global_concurrent_runs: 5,
    max_runs_per_repo: 1,
    max_runs_per_owner_team: 2,
    max_daily_runs: 30,
    retry_limit_per_task: 1,
  },
  allowed_task_types: [
    'dependabot_shepherd',
    'direct_security_patch',
    'dependency_freshness_patch',
    'repo_hygiene_scan',
    'repo_hygiene_config_pr',
    'ci_diagnosis',
  ],
  forbidden_paths: [],
  repo_criticality: {
    standard: {
      scheduled_runs: true,
      required_reviews: ['codeowners', 'repo_owner'],
    },
    sensitive: {
      scheduled_runs: true,
      required_reviews: ['codeowners', 'repo_owner', 'platform_security'],
    },
    critical: {
      scheduled_runs: true,
      max_concurrent_runs: 1,
      required_reviews: ['codeowners', 'repo_owner', 'platform_security', 'senior_reviewer'],
    },
  },
  task_policies: {},
};
