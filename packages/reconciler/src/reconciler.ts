import type { Octokit } from 'octokit';

import { getCheckStatusForRef, getProjectItems, getPR } from '@maintenance-factory/github-client';
import type { ProjectItem } from '@maintenance-factory/types';

import { resolveProjectState } from './state-resolver';

export interface ReconcilerDeps {
  octokit: Octokit;
  projectId: string;
}

export async function reconcileItem(
  deps: ReconcilerDeps,
  item: ProjectItem,
): Promise<{ changed: boolean; newStatus: import('@maintenance-factory/types').TaskStatus }> {
  const { octokit } = deps;

  if (!item.prUrl) {
    return { changed: false, newStatus: item.status };
  }

  const prMatch = item.prUrl.match(/\/pull\/(\d+)/);
  const prNumberStr = prMatch?.[1];
  if (!prNumberStr) {
    return { changed: false, newStatus: item.status };
  }
  const prNumber = parseInt(prNumberStr, 10);

  const [owner, repo] = item.repoFullName.split('/');
  if (!owner || !repo) {
    return { changed: false, newStatus: item.status };
  }

  const pr = await getPR(octokit, owner, repo, prNumber);
  const checks = await getCheckStatusForRef(octokit, owner, repo, pr.headRef);
  const newStatus = resolveProjectState(item.status, pr, checks);

  return { changed: newStatus !== item.status, newStatus };
}

export async function reconcileAll(
  deps: ReconcilerDeps,
): Promise<{ reconciled: number; changed: number }> {
  const items = await getProjectItems(deps.octokit, deps.projectId, [
    'PR Open',
    'Needs Review',
    'Blocked',
    'Agent Running',
  ]);

  let changed = 0;
  for (const item of items) {
    const result = await reconcileItem(deps, item);
    if (result.changed) changed++;
  }

  return { reconciled: items.length, changed };
}
