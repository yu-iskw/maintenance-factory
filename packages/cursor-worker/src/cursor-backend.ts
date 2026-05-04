import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { getErrorMessage } from '@maintenance-factory/types';

import type { WorkerResult, WorkerTask } from '@maintenance-factory/types';

export interface CursorBackendConfig {
  apiKey?: string;
  apiBaseUrl?: string;
}

export async function runWithCursor(
  task: WorkerTask,
  prompt: string,
  config: CursorBackendConfig,
): Promise<WorkerResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-cursor-'));
  const promptFile = path.join(tmpDir, 'prompt.md');
  const resultFile = path.join(tmpDir, 'result.json');

  try {
    fs.writeFileSync(promptFile, prompt, 'utf-8');

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CURSOR_TASK_PROMPT_FILE: promptFile,
      CURSOR_TASK_RESULT_FILE: resultFile,
      CURSOR_REPO: task.repoFullName,
      CURSOR_TASK_ID: task.compositeKey,
    };
    if (config.apiKey) env['CURSOR_API_KEY'] = config.apiKey;

    await spawnProcess('cursor', ['--headless', '--task', promptFile], { env });

    try {
      return JSON.parse(fs.readFileSync(resultFile, 'utf-8')) as WorkerResult;
    } catch (readErr: unknown) {
      const nodeErr = readErr as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        return { success: false, errorMessage: 'Cursor agent produced no result file' };
      }
      throw readErr;
    }
  } catch (err) {
    return { success: false, errorMessage: getErrorMessage(err) };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function spawnProcess(
  command: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(command, args, {
      env: options.env,
      stdio: 'inherit',
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process '${command}' exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}
