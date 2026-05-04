import type { RepoCriticality, Risk, TaskType } from './project';

export interface PolicyContext {
  repoFullName: string;
  repoCriticality: RepoCriticality;
  taskType: TaskType;
  risk: Risk;
  recentRunCount: number;
  hasOpenPR: boolean;
  requestedAt: Date;
}

export type PolicyDecision =
  | { allowed: true; reason: string }
  | { allowed: false; reason: string; blockedBy: string };

export interface TaskPolicy {
  allowedRisk?: Risk[];
  allowedScopes?: string[];
  requireAdvisoryReference?: boolean;
  maxRetries?: number;
}

export interface RepoCriticalityPolicy {
  scheduledRuns: boolean;
  maxConcurrentRuns?: number;
  requiredReviews: string[];
}

export interface PolicyConfig {
  version: number;
  global: {
    neverAutoMerge: boolean;
    maxGlobalConcurrentRuns: number;
    maxRunsPerRepo: number;
    maxRunsPerOwnerTeam: number;
    maxDailyRuns: number;
    retryLimitPerTask: number;
  };
  allowedTaskTypes: TaskType[];
  forbiddenPaths: string[];
  repoCriticality: Record<RepoCriticality, RepoCriticalityPolicy>;
  taskPolicies: Partial<Record<TaskType, TaskPolicy>>;
  repoOverrides?: Array<{
    repo: string;
    enabled?: boolean;
    reason?: string;
    maxRunsPerDay?: number;
    allowedTaskTypes?: TaskType[];
  }>;
}
