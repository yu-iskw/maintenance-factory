import type { PolicyConfig, PolicyContext, PolicyDecision } from '@maintenance-factory/types';

export function evaluatePolicy(config: PolicyConfig, context: PolicyContext): PolicyDecision {
  const { repoFullName, repoCriticality, taskType, risk, recentRunCount, hasOpenPR } = context;

  // Check repo-level overrides first
  const override = config.repoOverrides?.find((o) => o.repo === repoFullName);
  if (override?.enabled === false) {
    return {
      allowed: false,
      reason: override.reason ?? 'Repository is disabled in policy overrides',
      blockedBy: 'repo_override',
    };
  }

  // Task type must be in the global allowlist (or the override allowlist)
  const allowedTaskTypes = override?.allowedTaskTypes ?? config.allowedTaskTypes;
  if (!allowedTaskTypes.includes(taskType)) {
    return {
      allowed: false,
      reason: `Task type '${taskType}' is not in the allowed task types list`,
      blockedBy: 'task_type_not_allowed',
    };
  }

  // Repo criticality policy must allow scheduled runs
  // eslint-disable-next-line security/detect-object-injection
  const criticalityPolicy = config.repoCriticality[repoCriticality];
  if (!criticalityPolicy.scheduledRuns) {
    return {
      allowed: false,
      reason: `Scheduled runs are disabled for '${repoCriticality}' repos`,
      blockedBy: 'criticality_policy',
    };
  }

  // Per-repo override daily limit
  if (override?.maxRunsPerDay !== undefined && recentRunCount >= override.maxRunsPerDay) {
    return {
      allowed: false,
      reason: `Repo-level daily run limit of ${override.maxRunsPerDay} reached (${recentRunCount} runs today)`,
      blockedBy: 'repo_daily_limit',
    };
  }

  // Task-specific risk allowlist
  // eslint-disable-next-line security/detect-object-injection
  const taskPolicy = config.taskPolicies?.[taskType];
  if (taskPolicy?.allowedRisk && !taskPolicy.allowedRisk.includes(risk)) {
    return {
      allowed: false,
      reason: `Risk level '${risk}' is not allowed for task type '${taskType}'`,
      blockedBy: 'risk_not_allowed',
    };
  }

  // Block if there's already an open PR for this task
  if (hasOpenPR) {
    return {
      allowed: false,
      reason: 'An open PR already exists for this task',
      blockedBy: 'open_pr_exists',
    };
  }

  return {
    allowed: true,
    reason: `Task type '${taskType}' is allowed for '${repoCriticality}' repo with '${risk}' risk`,
  };
}
