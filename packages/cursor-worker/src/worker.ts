import { runWithCopilot } from './copilot-backend';
import { runWithCursor } from './cursor-backend';
import { renderPrompt } from './prompt-renderer';

import type { Db } from '@maintenance-factory/db';
import type { AppConfig, WorkerResult, WorkerTask } from '@maintenance-factory/types';
import type { Octokit } from 'octokit';

export interface WorkerDeps {
  octokit: Octokit;
  db: Db;
  config: Pick<AppConfig, 'workerBackend' | 'cursorApiKey' | 'cursorApiBaseUrl'>;
}

export async function runWorker(deps: WorkerDeps, task: WorkerTask): Promise<WorkerResult> {
  const prompt = renderPrompt(task);
  const { workerBackend } = deps.config;

  if (workerBackend === 'cursor') {
    return runWithCursor(task, prompt, {
      apiKey: deps.config.cursorApiKey,
      apiBaseUrl: deps.config.cursorApiBaseUrl,
    });
  }

  if (workerBackend === 'copilot') {
    return runWithCopilot(deps.octokit, task, prompt);
  }

  // 'both': try cursor first, fall back to copilot on failure
  const cursorResult = await runWithCursor(task, prompt, {
    apiKey: deps.config.cursorApiKey,
    apiBaseUrl: deps.config.cursorApiBaseUrl,
  });
  if (cursorResult.success) return cursorResult;

  return runWithCopilot(deps.octokit, task, prompt);
}
