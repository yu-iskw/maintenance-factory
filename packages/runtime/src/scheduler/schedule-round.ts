import {
  type PolicyDocument,
  type MaintenanceTask,
  type RepoProfile,
} from '@maintenance-factory/core';

import {
  evaluateSchedulePolicy,
  type ScheduleEvaluationContext,
} from '../policy/evaluate-schedule-policy.js';
import { evaluateKillSwitches, type KillSwitchRow } from '../store/kill-switches.js';
import { tryAcquireSchedulerLock } from '../store/locks.js';
import { insertPolicyDecision } from '../store/policy-decisions.js';

import type { PoolClient } from 'pg';

export interface ScheduleCandidate {
  task: MaintenanceTask;
  profile: RepoProfile;
  /** GitHub Projects v2 item node id */
  githubProjectItemId: string;
}

export interface ScheduleRoundResult {
  candidate: ScheduleCandidate;
  decision: 'allow' | 'deny';
  reasons: string[];
  lockKey?: string;
  lockAcquired?: boolean;
}

export interface ScheduleRoundOptions {
  policy: PolicyDocument;
  policyVersion: string;
  dryRun: boolean;
  killSwitchRows: KillSwitchRow[];
  contextBase: Omit<
    ScheduleEvaluationContext,
    | 'killSwitchGlobalPause'
    | 'killSwitchRepo'
    | 'killSwitchTaskType'
    | 'killSwitchEcosystem'
    | 'killSwitchCriticalRepo'
    | 'killSwitchWorkerDisabled'
  >;
  lockTtlSeconds: number;
}

function isSchedulableTask(task: MaintenanceTask): boolean {
  const statusOk = task.status === 'Ready' || task.status === 'Queued';
  const agentOk =
    task.agentStatus === 'NotRun' ||
    task.agentStatus === 'Queued' ||
    task.agentStatus === 'RetryNeeded';
  return statusOk && agentOk;
}

/**
 * Run one scheduling pass for the first eligible candidate (MVP single pick).
 */
export async function scheduleOneCandidate(
  client: PoolClient,
  candidates: ScheduleCandidate[],
  options: ScheduleRoundOptions,
): Promise<ScheduleRoundResult | null> {
  for (const candidate of candidates) {
    if (!isSchedulableTask(candidate.task)) {
      continue;
    }
    const ks = evaluateKillSwitches({
      repoFullName: candidate.task.repoFullName,
      taskType: candidate.task.taskType,
      ecosystem: candidate.task.ecosystem,
      repoCriticality: candidate.profile.repoCriticality,
      rows: options.killSwitchRows,
    });
    const ctx: ScheduleEvaluationContext = {
      ...options.contextBase,
      ...ks,
    };
    const outcome = evaluateSchedulePolicy(candidate.task, candidate.profile, options.policy, ctx);
    if (outcome.decision !== 'allow') {
      await insertPolicyDecision(client, {
        githubProjectItemId: candidate.githubProjectItemId,
        repoFullName: candidate.task.repoFullName,
        taskType: candidate.task.taskType,
        decision: outcome.decision,
        reason: outcome.reasons.join('; '),
        policyVersion: options.policyVersion,
      });
      continue;
    }

    const lockKey = `item:${candidate.task.idempotencyKey}`;
    if (options.dryRun) {
      await insertPolicyDecision(client, {
        githubProjectItemId: candidate.githubProjectItemId,
        repoFullName: candidate.task.repoFullName,
        taskType: candidate.task.taskType,
        decision: 'allow',
        reason: outcome.reasons.join('; '),
        policyVersion: options.policyVersion,
      });
      return {
        candidate,
        decision: 'allow',
        reasons: outcome.reasons,
        lockKey,
        lockAcquired: false,
      };
    }

    const acquired = await tryAcquireSchedulerLock(client, {
      key: lockKey,
      repoFullName: candidate.task.repoFullName,
      githubProjectItemId: candidate.githubProjectItemId,
      ttlSeconds: options.lockTtlSeconds,
    });
    if (!acquired) {
      await insertPolicyDecision(client, {
        githubProjectItemId: candidate.githubProjectItemId,
        repoFullName: candidate.task.repoFullName,
        taskType: candidate.task.taskType,
        decision: 'deny',
        reason: 'Could not acquire scheduler lock',
        policyVersion: options.policyVersion,
      });
      continue;
    }

    await insertPolicyDecision(client, {
      githubProjectItemId: candidate.githubProjectItemId,
      repoFullName: candidate.task.repoFullName,
      taskType: candidate.task.taskType,
      decision: 'allow',
      reason: outcome.reasons.join('; '),
      policyVersion: options.policyVersion,
    });
    return {
      candidate,
      decision: 'allow',
      reasons: outcome.reasons,
      lockKey,
      lockAcquired: true,
    };
  }
  return null;
}
