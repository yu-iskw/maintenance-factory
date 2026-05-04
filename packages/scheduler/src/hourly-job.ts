import type { Octokit } from 'octokit';

import { recordRunComplete, recordRunFailed, recordRunStart } from '@maintenance-factory/audit';
import type { Db } from '@maintenance-factory/db';
import { evaluatePolicy } from '@maintenance-factory/policy';
import type { AppConfig, PolicyConfig, SchedulerTick, WorkerTask } from '@maintenance-factory/types';
import { runWorker } from '@maintenance-factory/cursor-worker';

import { getEligibleItems } from './eligibility';
import { cleanStaleLocks, releaseLockByKey, tryAcquireLock } from './lock-manager';

export interface HourlyJobDeps {
  octokit: Octokit;
  db: Db;
  policy: PolicyConfig;
  config: AppConfig;
  activeRunCount: { value: number };
}

export async function runHourlyJob(deps: HourlyJobDeps): Promise<SchedulerTick> {
  const tick: SchedulerTick = {
    startedAt: new Date(),
    itemsConsidered: 0,
    itemsLaunched: 0,
    itemsSkippedByPolicy: 0,
    itemsSkippedByLock: 0,
    itemsSkippedByConcurrency: 0,
    errors: [],
  };

  await cleanStaleLocks(deps.db);

  const eligible = await getEligibleItems(deps.octokit, deps.config.githubProjectId);
  tick.itemsConsidered = eligible.length;

  for (const { projectItem, lockKey } of eligible) {
    if (deps.activeRunCount.value >= deps.config.maxGlobalConcurrentRuns) {
      tick.itemsSkippedByConcurrency++;
      continue;
    }

    const policyDecision = evaluatePolicy(deps.policy, {
      repoFullName: projectItem.repoFullName,
      repoCriticality: projectItem.repoCriticality,
      taskType: projectItem.maintenanceType,
      risk: projectItem.risk,
      recentRunCount: 0,
      hasOpenPR: Boolean(projectItem.prUrl),
      requestedAt: new Date(),
    });

    if (!policyDecision.allowed) {
      tick.itemsSkippedByPolicy++;
      continue;
    }

    if (deps.config.dryRun) {
      tick.itemsLaunched++;
      continue;
    }

    const lockAcquired = await tryAcquireLock(
      deps.db,
      lockKey,
      projectItem.repoFullName,
      projectItem.id,
      deps.config.lockTtlHours,
    );
    if (!lockAcquired) {
      tick.itemsSkippedByLock++;
      continue;
    }

    deps.activeRunCount.value++;
    const task: WorkerTask = {
      projectItemId: projectItem.id,
      repoFullName: projectItem.repoFullName,
      taskType: projectItem.maintenanceType,
      compositeKey: projectItem.compositeKey,
      taskTitle: `${projectItem.maintenanceType} for ${projectItem.repoFullName}`,
      taskBody: projectItem.lastRunSummary ?? '',
      risk: projectItem.risk,
      repoCriticality: projectItem.repoCriticality,
      promptTemplateVersion: '1.0.0',
    };

    const runId = await recordRunStart(deps.db, {
      id: crypto.randomUUID(),
      projectItemId: projectItem.id,
      repoFullName: projectItem.repoFullName,
      taskType: projectItem.maintenanceType,
      compositeKey: projectItem.compositeKey,
      backend: deps.config.workerBackend === 'copilot' ? 'copilot' : 'cursor',
      status: 'RUNNING',
      triggerSource: 'scheduler',
      startedAt: new Date(),
      promptTemplateVersion: '1.0.0',
    });

    runWorker({ octokit: deps.octokit, db: deps.db, config: deps.config }, task)
      .then(async (result) => {
        await recordRunComplete(deps.db, runId, result);
      })
      .catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        await recordRunFailed(deps.db, runId, message);
        tick.errors.push(message);
      })
      .finally(async () => {
        deps.activeRunCount.value--;
        await releaseLockByKey(deps.db, lockKey);
      });

    tick.itemsLaunched++;
  }

  return tick;
}
