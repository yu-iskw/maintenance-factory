import { getProjectItems } from '@maintenance-factory/github-client';

import { buildLockKey } from './lock-manager';

import type { EligibleItem, TaskStatus } from '@maintenance-factory/types';
import type { Octokit } from 'octokit';

const ELIGIBLE_STATUSES: TaskStatus[] = ['Ready', 'Queued'];

export async function getEligibleItems(
  octokit: Octokit,
  projectId: string,
): Promise<EligibleItem[]> {
  const items = await getProjectItems(octokit, projectId, ELIGIBLE_STATUSES);

  return items
    .filter((item) => item.agentEligible && item.scheduledEligible)
    .map((item) => ({
      projectItem: item,
      lockKey: buildLockKey(item.repoFullName, item.maintenanceType, item.compositeKey),
    }));
}
