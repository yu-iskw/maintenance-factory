import {
  defaultPolicyDocument,
  type PolicyDocument,
  type MaintenanceTask,
  type RepoProfile,
} from '@maintenance-factory/core';
import { describe, expect, it } from 'vitest';

import {
  evaluateSchedulePolicy,
  type ScheduleEvaluationContext,
} from './evaluate-schedule-policy.js';

function baseTask(overrides: Partial<MaintenanceTask> = {}): MaintenanceTask {
  return {
    idempotencyKey: 'org/r::dependabot_shepherd::1',
    repoFullName: 'org/r',
    taskType: 'dependabot_shepherd',
    externalId: '1',
    title: 'Shepherd',
    risk: 'Low',
    repoCriticality: 'standard',
    ecosystem: 'npm',
    agentEligible: true,
    scheduledEligible: true,
    status: 'Ready',
    agentStatus: 'NotRun',
    retryCount: 0,
    ...overrides,
  };
}

function baseProfile(overrides: Partial<RepoProfile> = {}): RepoProfile {
  return {
    repoFullName: 'org/r',
    codeownersPresent: true,
    packageManagers: ['pnpm'],
    repoCriticality: 'standard',
    testCommands: ['pnpm test'],
    buildCommands: ['pnpm build'],
    forbiddenPaths: ['src/auth/**'],
    ...overrides,
  };
}

function baseCtx(overrides: Partial<ScheduleEvaluationContext> = {}): ScheduleEvaluationContext {
  return {
    policyVersion: '1',
    repoInstalled: true,
    repoArchived: false,
    activeRunForSameRepoTask: false,
    conflictingOpenPr: false,
    globalConcurrentRuns: 0,
    ownerTeamConcurrentRuns: 0,
    dailyRunCount: 0,
    criticalRepoConcurrentRuns: 0,
    killSwitchGlobalPause: false,
    killSwitchRepo: false,
    killSwitchTaskType: false,
    killSwitchEcosystem: false,
    killSwitchCriticalRepo: false,
    killSwitchWorkerDisabled: false,
    ...overrides,
  };
}

describe('evaluateSchedulePolicy', () => {
  it('allows healthy dependabot_shepherd task', () => {
    const r = evaluateSchedulePolicy(baseTask(), baseProfile(), defaultPolicyDocument, baseCtx());
    expect(r.decision).toBe('allow');
    expect(r.neverAutoMerge).toBe(true);
    expect(r.requiredReviews).toContain('codeowners');
  });

  it('denies when agent not eligible', () => {
    const r = evaluateSchedulePolicy(
      baseTask({ agentEligible: false }),
      baseProfile(),
      defaultPolicyDocument,
      baseCtx(),
    );
    expect(r.decision).toBe('deny');
    expect(r.reasons.some((x) => x.includes('Agent Eligible'))).toBe(true);
  });

  it('denies global pause', () => {
    const r = evaluateSchedulePolicy(
      baseTask(),
      baseProfile(),
      defaultPolicyDocument,
      baseCtx({ killSwitchGlobalPause: true }),
    );
    expect(r.decision).toBe('deny');
  });

  it('denies risk outside task policy', () => {
    const policy: PolicyDocument = {
      ...defaultPolicyDocument,
      task_policies: {
        dependabot_shepherd: { allowed_risk: ['Low'] },
      },
    };
    const r = evaluateSchedulePolicy(
      baseTask({ risk: 'Critical' }),
      baseProfile(),
      policy,
      baseCtx(),
    );
    expect(r.decision).toBe('deny');
  });

  it('requires advisory for direct_security_patch when configured', () => {
    const policy: PolicyDocument = {
      ...defaultPolicyDocument,
      task_policies: {
        direct_security_patch: {
          require_advisory_reference: true,
          allowed_risk: ['Low', 'Medium'],
        },
      },
    };
    const task = baseTask({ taskType: 'direct_security_patch' });
    const deny = evaluateSchedulePolicy(
      task,
      baseProfile(),
      policy,
      baseCtx({ hasAdvisoryReference: false }),
    );
    expect(deny.decision).toBe('deny');
    const allow = evaluateSchedulePolicy(
      task,
      baseProfile(),
      policy,
      baseCtx({ hasAdvisoryReference: true }),
    );
    expect(allow.decision).toBe('allow');
  });
});
