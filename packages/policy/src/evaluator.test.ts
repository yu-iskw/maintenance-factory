import { describe, expect, it } from 'vitest';

import type { PolicyConfig, PolicyContext } from '@maintenance-factory/types';

import { evaluatePolicy } from './evaluator';

const baseConfig: PolicyConfig = {
  version: 1,
  global: {
    neverAutoMerge: true,
    maxGlobalConcurrentRuns: 5,
    maxRunsPerRepo: 1,
    maxRunsPerOwnerTeam: 2,
    maxDailyRuns: 30,
    retryLimitPerTask: 1,
  },
  allowedTaskTypes: [
    'dependabot_shepherd',
    'direct_security_patch',
    'dependency_freshness_patch',
    'repo_hygiene_scan',
    'repo_hygiene_config_pr',
    'ci_diagnosis',
  ],
  forbiddenPaths: ['infra/prod/**', 'migrations/**'],
  repoCriticality: {
    standard: { scheduledRuns: true, requiredReviews: ['codeowners', 'repo_owner'] },
    sensitive: { scheduledRuns: true, requiredReviews: ['codeowners', 'repo_owner', 'platform'] },
    critical: {
      scheduledRuns: true,
      maxConcurrentRuns: 1,
      requiredReviews: ['codeowners', 'repo_owner', 'platform', 'senior'],
    },
  },
  taskPolicies: {
    dependabot_shepherd: { allowedRisk: ['Low', 'Medium', 'High'], maxRetries: 1 },
    direct_security_patch: { allowedRisk: ['Low', 'Medium', 'High'], maxRetries: 1 },
    dependency_freshness_patch: { allowedRisk: ['Low'] },
    ci_diagnosis: { allowedRisk: ['Low', 'Medium'], maxRetries: 1 },
  },
};

const baseContext: PolicyContext = {
  repoFullName: 'org/my-repo',
  repoCriticality: 'standard',
  taskType: 'dependabot_shepherd',
  risk: 'Low',
  recentRunCount: 0,
  hasOpenPR: false,
  requestedAt: new Date(),
};

describe('evaluatePolicy', () => {
  it('allows an eligible standard repo task', () => {
    const result = evaluatePolicy(baseConfig, baseContext);
    expect(result.allowed).toBe(true);
  });

  it('allows a sensitive repo task', () => {
    const result = evaluatePolicy(baseConfig, { ...baseContext, repoCriticality: 'sensitive' });
    expect(result.allowed).toBe(true);
  });

  it('allows a critical repo task', () => {
    const result = evaluatePolicy(baseConfig, { ...baseContext, repoCriticality: 'critical' });
    expect(result.allowed).toBe(true);
  });

  it('denies a task type not in the allowlist', () => {
    const result = evaluatePolicy(baseConfig, {
      ...baseContext,
      taskType: 'repo_hygiene_config_pr',
    });
    // repo_hygiene_config_pr is in the list so this passes; remove it to test denial
    const restrictedConfig: PolicyConfig = {
      ...baseConfig,
      allowedTaskTypes: ['dependabot_shepherd'],
    };
    const denied = evaluatePolicy(restrictedConfig, {
      ...baseContext,
      taskType: 'repo_hygiene_config_pr',
    });
    expect(denied.allowed).toBe(false);
    expect(denied.allowed === false && denied.blockedBy).toBe('task_type_not_allowed');
  });

  it('denies a repo-level disabled override', () => {
    const config: PolicyConfig = {
      ...baseConfig,
      repoOverrides: [{ repo: 'org/my-repo', enabled: false, reason: 'frozen' }],
    };
    const result = evaluatePolicy(config, baseContext);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.blockedBy).toBe('repo_override');
  });

  it('denies when risk exceeds task policy', () => {
    const result = evaluatePolicy(baseConfig, {
      ...baseContext,
      taskType: 'dependency_freshness_patch',
      risk: 'High',
    });
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.blockedBy).toBe('risk_not_allowed');
  });

  it('denies when an open PR already exists', () => {
    const result = evaluatePolicy(baseConfig, { ...baseContext, hasOpenPR: true });
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.blockedBy).toBe('open_pr_exists');
  });

  it('respects repo override daily limit', () => {
    const config: PolicyConfig = {
      ...baseConfig,
      repoOverrides: [{ repo: 'org/my-repo', maxRunsPerDay: 2 }],
    };
    const result = evaluatePolicy(config, { ...baseContext, recentRunCount: 2 });
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.blockedBy).toBe('repo_daily_limit');
  });

  it('allows when repo override daily limit not yet reached', () => {
    const config: PolicyConfig = {
      ...baseConfig,
      repoOverrides: [{ repo: 'org/my-repo', maxRunsPerDay: 5 }],
    };
    const result = evaluatePolicy(config, { ...baseContext, recentRunCount: 3 });
    expect(result.allowed).toBe(true);
  });

  it('uses override allowedTaskTypes when repo override is present', () => {
    const config: PolicyConfig = {
      ...baseConfig,
      allowedTaskTypes: ['dependabot_shepherd'],
      repoOverrides: [
        { repo: 'org/my-repo', allowedTaskTypes: ['dependabot_shepherd', 'direct_security_patch'] },
      ],
    };
    const result = evaluatePolicy(config, { ...baseContext, taskType: 'direct_security_patch' });
    expect(result.allowed).toBe(true);
  });
});
