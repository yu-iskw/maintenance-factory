import type { Db } from '@maintenance-factory/db';
import { insertAgentRun, updateAgentRunStatus } from '@maintenance-factory/db';
import type { AgentRun, WorkerResult } from '@maintenance-factory/types';

export async function recordRunStart(db: Db, run: Omit<AgentRun, 'completedAt' | 'prUrl' | 'branchName' | 'filesChangedSummary' | 'validationSummary' | 'checkSummary' | 'errorMessage'>): Promise<string> {
  const row = await insertAgentRun(db, {
    ...run,
    status: 'RUNNING',
    startedAt: new Date(),
    completedAt: null,
    prUrl: null,
    branchName: null,
    filesChangedSummary: null,
    validationSummary: null,
    checkSummary: null,
    reviewerOutcome: null,
    errorMessage: null,
  });
  return row.id;
}

export async function recordRunComplete(
  db: Db,
  runId: string,
  result: WorkerResult,
): Promise<void> {
  await updateAgentRunStatus(db, runId, {
    status: result.success ? 'SUCCESS' : 'FAILED',
    completedAt: new Date(),
    prUrl: result.prUrl ?? null,
    branchName: result.branchName ?? null,
    filesChangedSummary: result.filesChanged?.join(', ') ?? null,
    validationSummary: result.validationSummary ?? null,
    errorMessage: result.errorMessage ?? null,
  });
}

export async function recordRunFailed(
  db: Db,
  runId: string,
  errorMessage: string,
): Promise<void> {
  await updateAgentRunStatus(db, runId, {
    status: 'FAILED',
    completedAt: new Date(),
    errorMessage,
  });
}
