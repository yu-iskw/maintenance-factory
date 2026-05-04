import type { WorkerResult, WorkerTask } from '@maintenance-factory/types';
import type { Octokit } from 'octokit';

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 60;

interface CopilotTaskResponse {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  pull_request?: { html_url: string; head?: { ref: string } };
  error?: string;
}

export async function runWithCopilot(
  octokit: Octokit,
  task: WorkerTask,
  prompt: string,
): Promise<WorkerResult> {
  const [owner, repo] = task.repoFullName.split('/');
  if (!owner || !repo) {
    return { success: false, errorMessage: `Invalid repo: ${task.repoFullName}` };
  }

  let taskId: string;
  try {
    const response = await octokit.request('POST /repos/{owner}/{repo}/copilot/tasks', {
      owner,
      repo,
      prompt,
      metadata: { compositeKey: task.compositeKey, taskType: task.taskType },
    });
    taskId = (response.data as { id: string }).id;
  } catch (err) {
    return {
      success: false,
      errorMessage: `Failed to create Copilot task: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const statusResponse = await octokit.request(
        'GET /repos/{owner}/{repo}/copilot/tasks/{task_id}',
        { owner, repo, task_id: taskId },
      );
      const taskStatus = statusResponse.data as CopilotTaskResponse;

      if (taskStatus.status === 'completed' && taskStatus.pull_request) {
        return {
          success: true,
          prUrl: taskStatus.pull_request.html_url,
          branchName: taskStatus.pull_request.head?.ref,
        };
      }

      if (taskStatus.status === 'failed') {
        return {
          success: false,
          errorMessage: taskStatus.error ?? 'Copilot task failed',
        };
      }
    } catch (err) {
      return {
        success: false,
        errorMessage: `Failed to poll Copilot task status: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { success: false, errorMessage: 'Copilot task timed out after maximum poll attempts' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
