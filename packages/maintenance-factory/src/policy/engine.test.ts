import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { evaluatePolicy, findForbiddenPathMatch } from './engine.js';
import { loadPolicyFromYamlFile } from './policy-document.js';

const policyPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'policy', 'default-policy.yaml');
const policy = loadPolicyFromYamlFile(policyPath);

describe('evaluatePolicy', () => {
  const base = {
    idempotencyKey: 'k',
    githubProjectItemId: 'PVTI_1',
    repoFullName: 'acme/service',
    taskType: 'dependabot_shepherd' as const,
    workflowStatus: 'ready' as const,
    risk: 'low' as const,
    repoCriticality: 'standard' as const,
    agentEligible: true,
    scheduledEligible: true,
    agentStatus: 'not_run' as const,
    retryCount: 0,
    hasConflictingOpenPr: false,
    hasActiveRunForRepoTask: false,
    repoArchived: false,
    repoInstalled: true,
    repoProfileExists: true,
  };

  it('allows a healthy dependabot shepherd task', () => {
    const result = evaluatePolicy(policy, base, 'test');
    expect(result.decision).toBe('allow');
  });

  it('defers when repo profile is missing', () => {
    const result = evaluatePolicy(policy, { ...base, repoProfileExists: false }, 'test');
    expect(result.decision).toBe('defer');
  });

  it('denies when agent eligibility is false', () => {
    const result = evaluatePolicy(policy, { ...base, agentEligible: false }, 'test');
    expect(result.decision).toBe('deny');
  });

  it('allows blocked workflow when agent requests retry', () => {
    const result = evaluatePolicy(
      policy,
      { ...base, workflowStatus: 'blocked', agentStatus: 'retry_needed' },
      'test',
    );
    expect(result.decision).toBe('allow');
  });

  it('requires advisory reference for direct security patches', () => {
    const result = evaluatePolicy(
      policy,
      { ...base, taskType: 'direct_security_patch', advisoryReference: '' },
      'test',
    );
    expect(result.decision).toBe('deny');
  });

  it('allows direct security patch with advisory reference', () => {
    const result = evaluatePolicy(
      policy,
      { ...base, taskType: 'direct_security_patch', advisoryReference: 'GHSA-xxxx' },
      'test',
    );
    expect(result.decision).toBe('allow');
  });
});

describe('findForbiddenPathMatch', () => {
  it('matches glob patterns', () => {
    const hit = findForbiddenPathMatch(['src/auth/login.ts'], policy.forbidden_paths);
    expect(hit).toBe('src/auth/login.ts');
  });
});
