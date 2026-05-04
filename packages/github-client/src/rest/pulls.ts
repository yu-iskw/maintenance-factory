import type { Octokit } from 'octokit';

import type { PullRequest } from '@maintenance-factory/types';

function mapPR(data: Record<string, unknown>): PullRequest {
  const d = data as {
    number: number;
    html_url: string;
    title: string;
    state: string;
    draft: boolean;
    head: { ref: string };
    base: { ref: string };
    created_at: string;
    updated_at: string;
    mergeable?: boolean | null;
  };
  return {
    number: d.number,
    url: d.html_url,
    title: d.title,
    state: d.state === 'open' ? 'open' : 'closed',
    headRef: d.head.ref,
    baseRef: d.base.ref,
    isDraft: d.draft ?? false,
    createdAt: new Date(d.created_at),
    updatedAt: new Date(d.updated_at),
    mergeable: d.mergeable ?? undefined,
  };
}

export async function getPR(octokit: Octokit, owner: string, repo: string, pullNumber: number): Promise<PullRequest> {
  const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });
  return mapPR(data as unknown as Record<string, unknown>);
}

export async function createPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  params: { title: string; body: string; head: string; base: string; draft?: boolean },
): Promise<PullRequest> {
  const { data } = await octokit.rest.pulls.create({ owner, repo, ...params });
  return mapPR(data as unknown as Record<string, unknown>);
}

export async function updatePRBody(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
): Promise<void> {
  await octokit.rest.pulls.update({ owner, repo, pull_number: pullNumber, body });
}

export async function listOpenPRs(octokit: Octokit, owner: string, repo: string): Promise<PullRequest[]> {
  const prs: PullRequest[] = [];
  for await (const { data } of octokit.paginate.iterator(octokit.rest.pulls.list, {
    owner,
    repo,
    state: 'open',
    per_page: 100,
  })) {
    for (const pr of data) {
      prs.push(mapPR(pr as unknown as Record<string, unknown>));
    }
  }
  return prs;
}
