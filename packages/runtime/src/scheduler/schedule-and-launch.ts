import { randomUUID } from 'node:crypto';

import { maintenanceAgentBranchName, workflowFor } from '@maintenance-factory/core';

import { promptContextFromTask, renderMaintenancePrompt } from '../cursor/prompt.js';
import { runMaintenanceCursorPrompt } from '../cursor/sdk-run.js';
import { insertAgentRun, updateAgentRunCompletion } from '../store/agent-runs.js';

import {
  scheduleOneCandidate,
  type ScheduleCandidate,
  type ScheduleRoundOptions,
  type ScheduleRoundResult,
} from './schedule-round.js';

import type { PoolClient } from 'pg';

/** Result shape from `@cursor/sdk` we care about for audit (keep loose to avoid SDK version lock-in). */
export type CursorPromptResult = {
  status?: string;
  id?: string;
};

export interface ScheduleAndLaunchOptions extends ScheduleRoundOptions {
  promptTemplateVersion: string;
  /** When empty, prompt lists no explicit allow paths (forbidden paths still apply). */
  allowedPaths?: string[];
  /**
   * Injected Cursor launch for tests. Defaults to `runMaintenanceCursorPrompt`.
   * Should return a value with `status` (e.g. `completed`) and optional `id` for audit linkage.
   */
  launchCursor?: (prompt: string) => Promise<CursorPromptResult>;
}

export interface ScheduleAndLaunchResult {
  schedule: ScheduleRoundResult | null;
  runUuid?: string;
  launchError?: string;
}

function defaultValidationCommands(candidate: ScheduleCandidate): string[] {
  const wf = workflowFor(candidate.task.taskType);
  if (candidate.profile.testCommands.length > 0) {
    return [...candidate.profile.testCommands];
  }
  return wf?.defaultValidationCommands ?? ['pnpm test'];
}

function cursorSucceeded(result: CursorPromptResult): boolean {
  return result.status === 'completed' || result.status === 'success';
}

async function defaultLaunchCursor(prompt: string): Promise<CursorPromptResult> {
  const raw = await runMaintenanceCursorPrompt({ prompt });
  return {
    status:
      typeof raw === 'object' && raw !== null && 'status' in raw
        ? String((raw as { status: unknown }).status)
        : undefined,
    id:
      typeof raw === 'object' && raw !== null && 'id' in raw
        ? String((raw as { id: unknown }).id)
        : undefined,
  };
}

/**
 * Policy-gated pick, lock acquisition, audit insert, rendered RFC §12 prompt, and Cursor SDK launch.
 * Dry-run scheduling never acquires a lock and therefore never launches.
 */
export async function scheduleAndLaunchOneCandidate(
  client: PoolClient,
  candidates: ScheduleCandidate[],
  options: ScheduleAndLaunchOptions,
): Promise<ScheduleAndLaunchResult> {
  const schedule = await scheduleOneCandidate(client, candidates, options);
  if (!schedule || schedule.decision !== 'allow' || !schedule.lockAcquired) {
    return { schedule };
  }

  const runUuid = randomUUID();
  const { candidate } = schedule;
  const validationCommands = defaultValidationCommands(candidate);
  const allowedPaths = options.allowedPaths ?? [];
  const branchName = maintenanceAgentBranchName(
    candidate.task.taskType,
    candidate.task.repoFullName,
    candidate.task.externalId,
  );

  await insertAgentRun(client, {
    runUuid,
    githubProjectItemId: candidate.githubProjectItemId,
    repoFullName: candidate.task.repoFullName,
    taskType: candidate.task.taskType,
    severity: candidate.task.severity,
    risk: candidate.task.risk,
    repoCriticality: candidate.task.repoCriticality,
    policyDecision: 'allow',
    policyReason: schedule.reasons.join('; '),
    promptTemplateVersion: options.promptTemplateVersion,
    status: 'Running',
    validationCommands,
    branchName,
  });

  const prompt = renderMaintenancePrompt(
    promptContextFromTask(
      candidate.task,
      candidate.profile,
      allowedPaths,
      validationCommands,
      options.promptTemplateVersion,
    ),
  );

  const launch = options.launchCursor ?? defaultLaunchCursor;

  try {
    const runResult = await launch(prompt);
    const ok = cursorSucceeded(runResult);
    await updateAgentRunCompletion(client, runUuid, {
      status: ok ? 'Succeeded' : 'Failed',
      cursorRunId: runResult.id,
      errorSummary: ok ? undefined : `cursor_status:${String(runResult.status ?? 'unknown')}`,
    });
    return { schedule, runUuid };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await updateAgentRunCompletion(client, runUuid, {
      status: 'Failed',
      errorSummary: message,
    });
    return { schedule, runUuid, launchError: message };
  }
}
