import type {
  PolicyDocument,
  MaintenanceTask,
  RepoProfile,
  ReviewRequirement,
} from '@maintenance-factory/core';

/** v1 policy outcome for scheduled runs (defer reserved for future rate-limit windows). */
export type ScheduleDecision = 'allow' | 'deny';

export interface ScheduleEvaluationContext {
  policyVersion: string;
  /** Repository is in app installation scope */
  repoInstalled: boolean;
  repoArchived: boolean;
  /** Another run is in progress for same repo+task idempotency */
  activeRunForSameRepoTask: boolean;
  /** Open PR already exists that conflicts with this task */
  conflictingOpenPr: boolean;
  globalConcurrentRuns: number;
  ownerTeamConcurrentRuns: number;
  dailyRunCount: number;
  criticalRepoConcurrentRuns: number;
  killSwitchGlobalPause: boolean;
  killSwitchRepo: boolean;
  killSwitchTaskType: boolean;
  killSwitchEcosystem: boolean;
  killSwitchCriticalRepo: boolean;
  killSwitchWorkerDisabled: boolean;
  /** Direct security patch must reference advisory when required */
  hasAdvisoryReference?: boolean;
}

export interface ScheduleEvaluationResult {
  decision: ScheduleDecision;
  reasons: string[];
  requiredReviews: ReviewRequirement[];
  neverAutoMerge: true;
}

function collectRequiredReviews(profile: RepoProfile, policy: PolicyDocument): ReviewRequirement[] {
  const entry = policy.repo_criticality[profile.repoCriticality];
  const raw = entry?.required_reviews ?? [];
  const allowed: ReviewRequirement[] = [
    'codeowners',
    'repo_owner',
    'platform_security',
    'senior_reviewer',
  ];
  return raw.filter((r): r is ReviewRequirement => allowed.includes(r as ReviewRequirement));
}

function riskAllowedForTask(
  policy: PolicyDocument,
  task: MaintenanceTask,
): { ok: boolean; reason?: string } {
  const rule = policy.task_policies[task.taskType];
  if (!rule?.allowed_risk) {
    return { ok: true };
  }
  if (!rule.allowed_risk.includes(task.risk)) {
    return { ok: false, reason: `Risk ${task.risk} not allowed for task type ${task.taskType}` };
  }
  return { ok: true };
}

function collectKillSwitchReasons(ctx: ScheduleEvaluationContext, profile: RepoProfile): string[] {
  const reasons: string[] = [];
  if (ctx.killSwitchGlobalPause) {
    reasons.push('Global scheduler pause');
  }
  if (ctx.killSwitchRepo) {
    reasons.push('Repo-level pause');
  }
  if (ctx.killSwitchTaskType) {
    reasons.push('Task-type pause');
  }
  if (ctx.killSwitchEcosystem) {
    reasons.push('Ecosystem pause');
  }
  if (ctx.killSwitchCriticalRepo && profile.repoCriticality === 'critical') {
    reasons.push('Critical-repo pause');
  }
  if (ctx.killSwitchWorkerDisabled) {
    reasons.push('Cursor worker disabled');
  }
  return reasons;
}

function collectTaskGateReasons(
  task: MaintenanceTask,
  profile: RepoProfile,
  policy: PolicyDocument,
  ctx: ScheduleEvaluationContext,
): string[] {
  const reasons: string[] = [];
  if (!['Ready', 'Queued'].includes(task.status)) {
    reasons.push(`Project status ${task.status} not eligible (expected Ready or Queued)`);
  }
  if (!['NotRun', 'Queued', 'RetryNeeded'].includes(task.agentStatus)) {
    reasons.push(`Agent status ${task.agentStatus} not eligible for scheduling`);
  }
  if (!task.agentEligible) {
    reasons.push('Agent Eligible is false');
  }
  if (!task.scheduledEligible) {
    reasons.push('Scheduled Eligible is false');
  }
  if (!policy.allowed_task_types.includes(task.taskType)) {
    reasons.push(`Task type ${task.taskType} not allowlisted`);
  }
  if (!ctx.repoInstalled) {
    reasons.push('Repository not in installation scope');
  }
  if (ctx.repoArchived) {
    reasons.push('Repository archived');
  }
  const critPolicy = policy.repo_criticality[profile.repoCriticality];
  if (critPolicy && !critPolicy.scheduled_runs) {
    reasons.push(`Scheduled runs disabled for ${profile.repoCriticality} repos`);
  }
  if (ctx.activeRunForSameRepoTask) {
    reasons.push('Active run exists for same repo and task');
  }
  if (ctx.conflictingOpenPr) {
    reasons.push('Conflicting open PR exists');
  }
  const riskCheck = riskAllowedForTask(policy, task);
  if (!riskCheck.ok && riskCheck.reason) {
    reasons.push(riskCheck.reason);
  }
  const taskRule = policy.task_policies[task.taskType];
  const maxRetries = taskRule?.max_retries ?? policy.global.retry_limit_per_task;
  if (task.retryCount > maxRetries) {
    reasons.push(`Retry count ${task.retryCount} exceeds limit ${maxRetries}`);
  }
  if (task.taskType === 'direct_security_patch' && taskRule?.require_advisory_reference) {
    if (!ctx.hasAdvisoryReference) {
      reasons.push('Advisory reference required for direct_security_patch');
    }
  }
  return reasons;
}

function collectConcurrencyReasons(
  profile: RepoProfile,
  policy: PolicyDocument,
  ctx: ScheduleEvaluationContext,
): string[] {
  const reasons: string[] = [];
  if (ctx.globalConcurrentRuns >= policy.global.max_global_concurrent_runs) {
    reasons.push('Global concurrent run limit reached');
  }
  if (ctx.ownerTeamConcurrentRuns >= policy.global.max_runs_per_owner_team) {
    reasons.push('Owner-team concurrent run limit reached');
  }
  if (ctx.dailyRunCount >= policy.global.max_daily_runs) {
    reasons.push('Daily run limit reached');
  }
  if (profile.repoCriticality === 'critical') {
    const maxCrit = policy.repo_criticality.critical.max_concurrent_runs ?? 1;
    if (ctx.criticalRepoConcurrentRuns >= maxCrit) {
      reasons.push('Critical repo concurrent run limit reached');
    }
  }
  return reasons;
}

/**
 * Evaluate whether a scheduled Cursor run is allowed (RFC §10.1).
 */
export function evaluateSchedulePolicy(
  task: MaintenanceTask,
  profile: RepoProfile,
  policy: PolicyDocument,
  ctx: ScheduleEvaluationContext,
): ScheduleEvaluationResult {
  const requiredReviews = collectRequiredReviews(profile, policy);

  if (!policy.global.never_auto_merge) {
    return {
      decision: 'deny',
      reasons: ['Policy must set never_auto_merge true'],
      requiredReviews,
      neverAutoMerge: true,
    };
  }

  const killReasons = collectKillSwitchReasons(ctx, profile);
  if (killReasons.length > 0) {
    return { decision: 'deny', reasons: killReasons, requiredReviews, neverAutoMerge: true };
  }

  const taskReasons = collectTaskGateReasons(task, profile, policy, ctx);
  const capReasons = collectConcurrencyReasons(profile, policy, ctx);
  const reasons = [...taskReasons, ...capReasons];
  if (reasons.length > 0) {
    return { decision: 'deny', reasons, requiredReviews, neverAutoMerge: true };
  }

  return {
    decision: 'allow',
    reasons: ['All policy gates passed'],
    requiredReviews,
    neverAutoMerge: true,
  };
}
