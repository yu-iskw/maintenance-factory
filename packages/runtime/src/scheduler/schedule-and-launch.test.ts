import {
  defaultPolicyDocument,
  type MaintenanceTask,
  type RepoProfile,
} from '@maintenance-factory/core';
import { describe, expect, it } from 'vitest';

import { scheduleAndLaunchOneCandidate } from './schedule-and-launch.js';

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

function trackingClient(): { client: PoolClient; sql: string[] } {
  const sql: string[] = [];
  const client = {
    query: async (q: string) => {
      sql.push(q);
      if (q.includes('INSERT INTO scheduler_locks')) {
        return { rowCount: 1, rows: [], command: '', oid: 0, fields: [] };
      }
      return { rowCount: 1, rows: [], command: '', oid: 0, fields: [] };
    },
  } as unknown as PoolClient;
  return { client, sql };
}

describe('scheduleAndLaunchOneCandidate', () => {
  it('does not insert agent_runs in scheduling dry-run', async () => {
    const { client, sql } = trackingClient();
    const res = await scheduleAndLaunchOneCandidate(
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
        promptTemplateVersion: 'v1',
        launchCursor: async () => {
          throw new Error('launch should not be called in dry-run');
        },
      },
    );
    expect(res.schedule?.lockAcquired).toBe(false);
    expect(res.runUuid).toBeUndefined();
    expect(sql.some((s) => s.includes('INSERT INTO agent_runs'))).toBe(false);
  });

  it('records agent run and completion when lock acquired', async () => {
    const { client, sql } = trackingClient();
    let launched = false;
    const res = await scheduleAndLaunchOneCandidate(
      client,
      [{ task: task(), profile: profile(), githubProjectItemId: 'PVT_1' }],
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
        promptTemplateVersion: 'v1',
        launchCursor: async () => {
          launched = true;
          return { status: 'completed', id: 'run_xyz' };
        },
      },
    );
    expect(res.schedule?.lockAcquired).toBe(true);
    expect(res.runUuid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(launched).toBe(true);
    expect(sql.some((s) => s.includes('INSERT INTO agent_runs'))).toBe(true);
    expect(sql.some((s) => s.includes('UPDATE agent_runs'))).toBe(true);
  });
});
