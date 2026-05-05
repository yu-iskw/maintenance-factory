import { computeIdempotencyKey, type MaintenanceTask } from '@maintenance-factory/core';

import type { Octokit } from '@octokit/rest';

const DEPENDABOT_LOGINS = new Set(['dependabot[bot]', 'dependabot-preview[bot]']);

export function isDependabotPull(userLogin: string | undefined): boolean {
  if (!userLogin) {
    return false;
  }
  return DEPENDABOT_LOGINS.has(userLogin);
}

export async function listOpenDependabotPulls(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<MaintenanceTask[]> {
  const tasks: MaintenanceTask[] = [];
  for await (const { data } of octokit.paginate.iterator(octokit.rest.pulls.list, {
    owner,
    repo,
    state: 'open',
    per_page: 100,
  })) {
    for (const pr of data) {
      if (!isDependabotPull(pr.user?.login)) {
        continue;
      }
      const externalId = String(pr.number);
      const repoFullName = `${owner}/${repo}`;
      tasks.push({
        idempotencyKey: computeIdempotencyKey(
          repoFullName,
          'dependabot_shepherd',
          `pr-${externalId}`,
        ),
        repoFullName,
        taskType: 'dependabot_shepherd',
        externalId,
        title: pr.title,
        body: pr.body ?? undefined,
        severity: 'Medium',
        risk: 'Low',
        repoCriticality: 'standard',
        ecosystem: 'unknown',
        agentEligible: true,
        scheduledEligible: true,
        status: 'Inbox',
        agentStatus: 'NotRun',
        prUrl: pr.html_url,
        prContentNodeId: typeof pr.node_id === 'string' ? pr.node_id : undefined,
        retryCount: 0,
      });
    }
  }
  return tasks;
}
