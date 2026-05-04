import { getCheckStatusForRef, getProjectItems, getPR } from '@maintenance-factory/github-client';

import { resolveProjectState } from './state-resolver';

import type { TaskStatus } from '@maintenance-factory/types';
import type { Octokit } from 'octokit';

export interface ReconcilerDeps {
  octokit: Octokit;
  projectId: string;
}

export interface ReconcileTarget {
  prUrl?: string;
  status: TaskStatus;
  repoFullName: string;
}

const RECONCILE_BATCH_SIZE = 10;

export async function reconcileItem(
  deps: ReconcilerDeps,
  item: ReconcileTarget,
): Promise<{ changed: boolean; newStatus: TaskStatus }> {
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
  for (let i = 0; i < items.length; i += RECONCILE_BATCH_SIZE) {
    const batch = items.slice(i, i + RECONCILE_BATCH_SIZE);
    const results = await Promise.all(batch.map((item) => reconcileItem(deps, item)));
    changed += results.filter((r) => r.changed).length;
  }

  return { reconciled: items.length, changed };
}
