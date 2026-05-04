import type { Octokit } from 'octokit';

import type { CheckStatus } from '@maintenance-factory/types';

export async function getCheckStatusForRef(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
): Promise<CheckStatus> {
  const { data } = await octokit.rest.checks.listForRef({ owner, repo, ref, per_page: 100 });
  const runs = data.check_runs;

  type CheckRun = (typeof runs)[number];
  const failed = runs.filter((r: CheckRun) => r.conclusion === 'failure' || r.conclusion === 'timed_out' || r.conclusion === 'action_required');
  const pending = runs.filter((r: CheckRun) => r.status === 'in_progress' || r.status === 'queued');
  const allSuccess = failed.length === 0 && pending.length === 0 && runs.length > 0;

  let state: CheckStatus['state'] = 'pending';
  if (failed.length > 0) state = 'failure';
  else if (allSuccess) state = 'success';

  return {
    state,
    conclusion: failed[0]?.conclusion as CheckStatus['conclusion'] ?? null,
    totalCount: runs.length,
    failedCount: failed.length,
    pendingCount: pending.length,
  };
}
