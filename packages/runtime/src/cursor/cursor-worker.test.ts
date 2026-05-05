import { describe, expect, it } from 'vitest';

import { assertChangesAllowed, pathMatchesForbidden } from './forbidden-paths.js';
import { buildMaintenancePrBody } from './pr-body.js';
import { promptContextFromTask, renderMaintenancePrompt } from './prompt.js';

import type { MaintenanceTask, RepoProfile } from '@maintenance-factory/core';

describe('forbidden paths', () => {
  it('matches prefix glob', () => {
    expect(pathMatchesForbidden('src/auth/login.ts', 'src/auth/**')).toBe(true);
    expect(pathMatchesForbidden('src/billing/x.ts', 'src/auth/**')).toBe(false);
  });

  it('treats dot in glob extension literally', () => {
    expect(pathMatchesForbidden('src/pkg/foo.tf', '**/foo.tf')).toBe(true);
    expect(pathMatchesForbidden('src/pkg/footf', '**/foo.tf')).toBe(false);
  });

  it('treats lone ** as matching any path (forbid-all policy)', () => {
    expect(pathMatchesForbidden('a/b/c.ts', '**')).toBe(true);
    expect(pathMatchesForbidden('x', '**')).toBe(true);
    expect(pathMatchesForbidden('', '**')).toBe(true);
  });

  it('assertChangesAllowed fails on hit', () => {
    const r = assertChangesAllowed(['src/auth/x.ts'], ['src/auth/**']);
    expect(r.ok).toBe(false);
  });
});

describe('PR body', () => {
  it('includes agent notice', () => {
    const task: MaintenanceTask = {
      idempotencyKey: 'k',
      repoFullName: 'o/r',
      taskType: 'dependabot_shepherd',
      externalId: '1',
      title: 't',
      risk: 'Low',
      repoCriticality: 'standard',
      ecosystem: 'npm',
      agentEligible: true,
      scheduledEligible: true,
      status: 'Ready',
      agentStatus: 'NotRun',
      retryCount: 0,
    };
    const body = buildMaintenancePrBody({
      summary: 'fix',
      task,
      filesChanged: ['package.json'],
      commandsRun: ['pnpm test'],
      testResults: '* Tests passed',
      residualRisk: 'low',
    });
    expect(body).toContain('merged manually');
  });
});

describe('prompt', () => {
  it('includes Do not merge', () => {
    const profile: RepoProfile = {
      repoFullName: 'o/r',
      codeownersPresent: true,
      packageManagers: [],
      repoCriticality: 'standard',
      testCommands: ['pnpm test'],
      buildCommands: [],
      forbiddenPaths: ['infra/**'],
    };
    const task: MaintenanceTask = {
      idempotencyKey: 'k',
      repoFullName: 'o/r',
      taskType: 'dependabot_shepherd',
      externalId: '1',
      title: 'bump',
      risk: 'Low',
      repoCriticality: 'standard',
      ecosystem: 'npm',
      agentEligible: true,
      scheduledEligible: true,
      status: 'Ready',
      agentStatus: 'NotRun',
      retryCount: 0,
    };
    const ctx = promptContextFromTask(task, profile, ['package.json'], ['pnpm test'], 'v1');
    expect(renderMaintenancePrompt(ctx)).toContain('Do not merge');
  });
});
