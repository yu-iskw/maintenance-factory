import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { loadPolicyFromYamlFile } from '../policy/policy-document.js';

import { MaintenanceScheduler } from './scheduler.js';

import type { AgentRunInsert } from '../db/store.js';

const policyPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'policy', 'default-policy.yaml');
const policy = loadPolicyFromYamlFile(policyPath);

function createFakeStore() {
  return {
    paused: false,
    globalRunning: 0,
    daily: 0,
    repoRunning: 0,
    teamRunning: 0,
    criticalRunning: 0,
    locks: new Set<string>(),
    decisions: [] as Array<Record<string, unknown>>,
    runs: [] as AgentRunInsert[],
    async isGlobalPaused() {
      return this.paused;
    },
    async isRepoPaused() {
      return false;
    },
    async isTaskTypePaused() {
      return false;
    },
    async insertPolicyDecision(input: Record<string, unknown>) {
      this.decisions.push(input);
    },
    async countGlobalRunning() {
      return this.globalRunning;
    },
    async countRunsStartedToday() {
      return this.daily;
    },
    async countRunningForRepo() {
      return this.repoRunning;
    },
    async countRunningForOwnerTeam() {
      return this.teamRunning;
    },
    async countRunningForCriticalRepos() {
      return this.criticalRunning;
    },
    async tryAcquireLock(key: string) {
      if (this.locks.has(key)) {
        return false;
      }
      this.locks.add(key);
      return true;
    },
    async releaseLock(key: string) {
      this.locks.delete(key);
    },
    async insertAgentRun(row: AgentRunInsert) {
      this.runs.push(row);
    },
    async updateAgentRunByUuid() {
      return;
    },
  };
}

describe('MaintenanceScheduler', () => {
  it('does not launch when globally paused', async () => {
    const store = createFakeStore();
    store.paused = true;
    const worker = { launch: vi.fn() };
    const scheduler = new MaintenanceScheduler(policy, 'test', store, worker, 'v1');
    const result = await scheduler.scheduleNext([
      {
        idempotencyKey: 'k',
        repoFullName: 'acme/a',
        taskType: 'dependabot_shepherd',
        workflowStatus: 'ready',
        risk: 'low',
        repoCriticality: 'standard',
        agentEligible: true,
        scheduledEligible: true,
        agentStatus: 'not_run',
        retryCount: 0,
        hasConflictingOpenPr: false,
        hasActiveRunForRepoTask: false,
        repoArchived: false,
        repoInstalled: true,
        repoProfileExists: true,
      },
    ]);
    expect(result.launched).toBe(false);
    expect(worker.launch).not.toHaveBeenCalled();
  });

  it('launches first eligible task', async () => {
    const store = createFakeStore();
    const worker = { launch: vi.fn(async () => ({ cursorRunId: 'run_1', dryRun: false })) };
    const scheduler = new MaintenanceScheduler(policy, 'test', store, worker, 'v1');
    const result = await scheduler.scheduleNext([
      {
        idempotencyKey: 'k',
        repoFullName: 'acme/a',
        taskType: 'dependabot_shepherd',
        workflowStatus: 'ready',
        risk: 'low',
        repoCriticality: 'standard',
        agentEligible: true,
        scheduledEligible: true,
        agentStatus: 'not_run',
        retryCount: 0,
        hasConflictingOpenPr: false,
        hasActiveRunForRepoTask: false,
        repoArchived: false,
        repoInstalled: true,
        repoProfileExists: true,
        ownerTeam: 'platform',
      },
    ]);
    expect(result.launched).toBe(true);
    expect(worker.launch).toHaveBeenCalledTimes(1);
  });
});
