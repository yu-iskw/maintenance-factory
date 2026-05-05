import {
  defaultPolicyDocument,
  type MaintenanceTask,
  type RepoProfile,
} from '@maintenance-factory/core';
import { describe, expect, it } from 'vitest';

import { scheduleOneCandidate } from './schedule-round.js';

import type { PoolClient } from 'pg';

function profile(): RepoProfile {
  return {
    repoFullName: 'org/r',
    codeownersPresent: true,
    packageManagers: ['pnpm'],
    repoCriticality: 'standard',
    testCommands: ['pnpm test'],
    buildCommands: ['pnpm build'],
    forbiddenPaths: [],
  };
}

function task(overrides: Partial<MaintenanceTask> = {}): MaintenanceTask {
  return {
    idempotencyKey: 'k',
    repoFullName: 'org/r',
    taskType: 'dependabot_shepherd',
    externalId: '99',
    title: 'bump',
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

function fakeClient(): PoolClient {
  return {
    query: async (sql: string) => {
      if (sql.includes('INSERT INTO scheduler_locks')) {
        return { rowCount: 1, rows: [], command: '', oid: 0, fields: [] };
      }
      return { rowCount: 0, rows: [], command: '', oid: 0, fields: [] };
    },
  } as unknown as PoolClient;
}

function fakeClientLockFailsThenSucceeds(): PoolClient {
  let lockInsertCount = 0;
  return {
    query: async (sql: string) => {
      if (sql.includes('INSERT INTO scheduler_locks')) {
        lockInsertCount += 1;
        return {
          rowCount: lockInsertCount === 1 ? 0 : 1,
          rows: [],
          command: '',
          oid: 0,
          fields: [],
        };
      }
      return { rowCount: 0, rows: [], command: '', oid: 0, fields: [] };
    },
  } as unknown as PoolClient;
}

describe('scheduleOneCandidate', () => {
  it('allows in dry-run without acquiring lock', async () => {
    const client = fakeClient();
    const res = await scheduleOneCandidate(
      client,
      [{ task: task(), profile: profile(), githubProjectItemId: 'PVT_1' }],
      {
        policy: defaultPolicyDocument,
        policyVersion: '1',
        dryRun: true,
        killSwitchRows: [],
        contextBase: {
          policyVersion: '1',
          repoInstalled: true,
          repoArchived: false,
          activeRunForSameRepoTask: false,
          conflictingOpenPr: false,
          globalConcurrentRuns: 0,
          ownerTeamConcurrentRuns: 0,
          dailyRunCount: 0,
          criticalRepoConcurrentRuns: 0,
        },
        lockTtlSeconds: 60,
      },
    );
    expect(res?.decision).toBe('allow');
    expect(res?.lockAcquired).toBe(false);
  });

  it('skips policy-denied candidate and schedules the next in dry-run', async () => {
    const client = fakeClient();
    const res = await scheduleOneCandidate(
      client,
      [
        {
          task: { ...task(), agentEligible: false },
          profile: profile(),
          githubProjectItemId: 'PVT_1',
        },
        {
          task: {
            ...task(),
            repoFullName: 'org/b',
            idempotencyKey: 'kb',
            externalId: '2',
          },
          profile: { ...profile(), repoFullName: 'org/b' },
          githubProjectItemId: 'PVT_2',
        },
      ],
      {
        policy: defaultPolicyDocument,
        policyVersion: '1',
        dryRun: true,
        killSwitchRows: [],
        contextBase: {
          policyVersion: '1',
          repoInstalled: true,
          repoArchived: false,
          activeRunForSameRepoTask: false,
          conflictingOpenPr: false,
          globalConcurrentRuns: 0,
          ownerTeamConcurrentRuns: 0,
          dailyRunCount: 0,
          criticalRepoConcurrentRuns: 0,
        },
        lockTtlSeconds: 60,
      },
    );
    expect(res?.candidate.githubProjectItemId).toBe('PVT_2');
    expect(res?.decision).toBe('allow');
  });

  it('continues when lock not acquired and picks next candidate', async () => {
    const client = fakeClientLockFailsThenSucceeds();
    const res = await scheduleOneCandidate(
      client,
      [
        { task: task(), profile: profile(), githubProjectItemId: 'PVT_A' },
        {
          task: { ...task(), idempotencyKey: 'k2', externalId: '100' },
          profile: profile(),
          githubProjectItemId: 'PVT_B',
        },
      ],
      {
        policy: defaultPolicyDocument,
        policyVersion: '1',
        dryRun: false,
        killSwitchRows: [],
        contextBase: {
          policyVersion: '1',
          repoInstalled: true,
          repoArchived: false,
          activeRunForSameRepoTask: false,
          conflictingOpenPr: false,
          globalConcurrentRuns: 0,
          ownerTeamConcurrentRuns: 0,
          dailyRunCount: 0,
          criticalRepoConcurrentRuns: 0,
        },
        lockTtlSeconds: 60,
      },
    );
    expect(res?.candidate.githubProjectItemId).toBe('PVT_B');
    expect(res?.lockAcquired).toBe(true);
  });
});
