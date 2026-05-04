import { randomUUID } from 'node:crypto';

import { evaluatePolicy } from '../policy/engine.js';

import type { SchedulerStore } from './store-port.js';
import type { PolicyDocument } from '../policy/policy-document.js';
import type { MaintenanceTaskInput, PolicyEvaluation } from '../types/domain.js';
import type { MaintenanceWorker, WorkerLaunchInput } from '../worker/maintenance-worker.js';

export type SchedulerResult =
  | { launched: false; reason: string }
  | { launched: true; task: MaintenanceTaskInput; runUuid: string; cursorRunId: string };

function buildWorkerLaunchInput(input: {
  runUuid: string;
  task: MaintenanceTaskInput;
  promptTemplateVersion: string;
  dryRun: boolean;
}): WorkerLaunchInput {
  return {
    runUuid: input.runUuid,
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
    dryRun: input.dryRun,
  };
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
  dryRun: boolean;
}): Promise<SchedulerResult> {
  if (input.dryRun) {
    const runUuid = randomUUID();
    const launch = await input.worker.launch(
      buildWorkerLaunchInput({
        runUuid,
        task: input.task,
        promptTemplateVersion: input.promptTemplateVersion,
        dryRun: true,
      }),
    );
    return { launched: true, task: input.task, runUuid, cursorRunId: launch.cursorRunId };
  }

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

    const launch = await input.worker.launch(
      buildWorkerLaunchInput({
        runUuid,
        task: input.task,
        promptTemplateVersion: input.promptTemplateVersion,
        dryRun: input.dryRun,
      }),
    );

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

  private async shouldSkipTask(task: MaintenanceTaskInput): Promise<boolean> {
    if (await this.store.isRepoPaused(task.repoFullName)) {
      return true;
    }
    if (await this.store.isTaskTypePaused(task.taskType)) {
      return true;
    }
    if (task.ecosystem && (await this.store.isEcosystemPaused(task.ecosystem))) {
      return true;
    }
    if (task.repoCriticality === 'critical' && (await this.store.isCriticalReposPaused())) {
      return true;
    }
    return false;
  }

  async scheduleNext(
    tasks: MaintenanceTaskInput[],
    options?: { dryRun?: boolean },
  ): Promise<SchedulerResult> {
    const dryRun = options?.dryRun === true;
    const globalReason = (await this.store.isGlobalPaused()) ? 'global kill switch active' : undefined;
    if (globalReason) {
      return { launched: false, reason: globalReason };
    }
    if (await this.store.isCursorWorkerDisabled()) {
      return { launched: false, reason: 'cursor worker disabled' };
    }

    for (const task of tasks) {
      if (await this.shouldSkipTask(task)) {
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
        dryRun,
      });
      if (launchResult.launched) {
        return launchResult;
      }
    }

    return { launched: false, reason: 'no eligible tasks' };
  }
}
