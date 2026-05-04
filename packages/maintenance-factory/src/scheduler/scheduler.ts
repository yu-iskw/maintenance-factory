import { randomUUID } from 'node:crypto';

import { evaluatePolicy } from '../policy/engine.js';

import type { SchedulerStore } from './store-port.js';
import type { PolicyDocument } from '../policy/policy-document.js';
import type { MaintenanceTaskInput, PolicyEvaluation } from '../types/domain.js';
import type { MaintenanceWorker } from '../worker/maintenance-worker.js';

export type SchedulerResult =
  | { launched: false; reason: string }
  | { launched: true; task: MaintenanceTaskInput; runUuid: string; cursorRunId: string };

function isGloballyBlocked(store: SchedulerStore): Promise<string | undefined> {
  return store.isGlobalPaused().then((paused) => (paused ? 'global kill switch active' : undefined));
}

async function evaluateConcurrencyCaps(
  policy: PolicyDocument,
  store: SchedulerStore,
  task: MaintenanceTaskInput,
): Promise<'ok' | 'skip_task' | 'abort_tick'> {
  const globalRunning = await store.countGlobalRunning();
  if (globalRunning >= policy.global.max_global_concurrent_runs) {
    return 'abort_tick';
  }

  const daily = await store.countRunsStartedToday();
  if (daily >= policy.global.max_daily_runs) {
    return 'abort_tick';
  }

  if (task.repoCriticality === 'critical') {
    const cap = policy.global.max_critical_repo_runs ?? 1;
    const criticalRunning = await store.countRunningForCriticalRepos();
    if (criticalRunning >= cap) {
      return 'skip_task';
    }
  }

  const repoRunning = await store.countRunningForRepo(task.repoFullName);
  if (repoRunning >= policy.global.max_runs_per_repo) {
    return 'skip_task';
  }

  const ownerTeam = task.ownerTeam ?? 'unknown';
  const teamRunning = await store.countRunningForOwnerTeam(ownerTeam);
  if (teamRunning >= policy.global.max_runs_per_owner_team) {
    return 'skip_task';
  }

  return 'ok';
}

async function launchApprovedTask(input: {
  store: SchedulerStore;
  worker: MaintenanceWorker;
  policy: PolicyDocument;
  policyVersion: string;
  promptTemplateVersion: string;
  task: MaintenanceTaskInput;
  decision: PolicyEvaluation;
}): Promise<SchedulerResult> {
  const lockKey = `repo:${input.task.repoFullName}`;
  const acquired = await input.store.tryAcquireLock(
    lockKey,
    input.task.repoFullName,
    input.task.githubProjectItemId,
    15 * 60 * 1000,
  );
  if (!acquired) {
    return { launched: false, reason: 'could not acquire scheduler lock' };
  }

  const runUuid = randomUUID();
  try {
    await input.store.insertAgentRun({
      runUuid,
      githubProjectItemId: input.task.githubProjectItemId,
      repoFullName: input.task.repoFullName,
      ownerTeam: input.task.ownerTeam,
      taskType: input.task.taskType,
      severity: input.task.severity,
      risk: input.task.risk,
      repoCriticality: input.task.repoCriticality,
      policyDecision: input.decision.decision,
      policyReason: input.decision.reason,
      promptTemplateVersion: input.promptTemplateVersion,
      status: 'running',
      startedAt: new Date(),
    });

    const launch = await input.worker.launch({
      runUuid,
      repoFullName: input.task.repoFullName,
      taskType: input.task.taskType,
      risk: input.task.risk,
      repoCriticality: input.task.repoCriticality,
      taskTitle: `${input.task.taskType} for ${input.task.repoFullName}`,
      taskBody: JSON.stringify({
        idempotencyKey: input.task.idempotencyKey,
        prUrl: input.task.prUrl,
        prNumber: input.task.prNumber,
      }),
      promptTemplateVersion: input.promptTemplateVersion,
      dryRun: false,
    });

    await input.store.updateAgentRunByUuid(runUuid, {
      cursorRunId: launch.cursorRunId,
      status: 'running',
    });
    await input.store.releaseLock(lockKey);
    return { launched: true, task: input.task, runUuid, cursorRunId: launch.cursorRunId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await input.store.releaseLock(lockKey);
    await input.store.updateAgentRunByUuid(runUuid, {
      status: 'failed',
      errorSummary: message,
      completedAt: new Date(),
    });
    return { launched: false, reason: message };
  }
}

export class MaintenanceScheduler {
  constructor(
    private readonly policy: PolicyDocument,
    private readonly policyVersion: string,
    private readonly store: SchedulerStore,
    private readonly worker: MaintenanceWorker,
    private readonly promptTemplateVersion: string,
  ) {}

  async scheduleNext(tasks: MaintenanceTaskInput[]): Promise<SchedulerResult> {
    const globalReason = await isGloballyBlocked(this.store);
    if (globalReason) {
      return { launched: false, reason: globalReason };
    }

    for (const task of tasks) {
      if (await this.store.isRepoPaused(task.repoFullName)) {
        continue;
      }
      if (await this.store.isTaskTypePaused(task.taskType)) {
        continue;
      }

      const decision = evaluatePolicy(this.policy, task, this.policyVersion);
      await this.store.insertPolicyDecision({
        githubProjectItemId: task.githubProjectItemId,
        repoFullName: task.repoFullName,
        taskType: task.taskType,
        decision: decision.decision,
        reason: decision.reason,
        policyVersion: decision.policyVersion,
      });

      if (decision.decision !== 'allow') {
        continue;
      }

      const cap = await evaluateConcurrencyCaps(this.policy, this.store, task);
      if (cap === 'abort_tick') {
        return { launched: false, reason: 'global or daily concurrency cap reached' };
      }
      if (cap === 'skip_task') {
        continue;
      }

      const launchResult = await launchApprovedTask({
        store: this.store,
        worker: this.worker,
        policy: this.policy,
        policyVersion: this.policyVersion,
        promptTemplateVersion: this.promptTemplateVersion,
        task,
        decision,
      });
      if (launchResult.launched) {
        return launchResult;
      }
    }

    return { launched: false, reason: 'no eligible tasks' };
  }
}
