import { listDependabotAlerts, listDependabotPRs } from '@maintenance-factory/github-client';

import { buildCompositeKey } from './composite-key';

import type { DependabotAlert } from '@maintenance-factory/types';
import type { Octokit } from 'octokit';

export interface DependabotScanResult {
  repoFullName: string;
  stalePRs: Array<{
    number: number;
    title: string;
    url: string;
    compositeKey: string;
    staleDays: number;
  }>;
  unremediedAlerts: Array<DependabotAlert & { compositeKey: string }>;
}

const STALE_THRESHOLD_DAYS = 14;

export async function scanDependabot(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<DependabotScanResult> {
  const repoFullName = `${owner}/${repo}`;
  const now = new Date();

  const [prs, alerts] = await Promise.all([
    listDependabotPRs(octokit, owner, repo),
    listDependabotAlerts(octokit, owner, repo),
  ]);

  const stalePRs = prs
    .map((pr) => ({
      ...pr,
      compositeKey: buildCompositeKey('dependabot', 'dependabot_shepherd', repoFullName, pr.number),
      staleDays: Math.floor((now.getTime() - pr.updatedAt.getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .filter((pr) => pr.staleDays >= STALE_THRESHOLD_DAYS);

  const unremediedAlerts = alerts.map((alert) => ({
    ...alert,
    compositeKey: buildCompositeKey(
      'dependabot',
      'direct_security_patch',
      repoFullName,
      alert.number,
    ),
  }));

  return { repoFullName, stalePRs, unremediedAlerts };
}
