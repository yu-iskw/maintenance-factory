import type { Octokit } from 'octokit';

import { getProjectItems } from '@maintenance-factory/github-client';
import type { EligibleItem, ProjectItem } from '@maintenance-factory/types';

const ELIGIBLE_STATUSES = ['Ready', 'Queued'] as const;

export async function getEligibleItems(
  octokit: Octokit,
  projectId: string,
): Promise<EligibleItem[]> {
  const items = await getProjectItems(
    octokit,
    projectId,
    ELIGIBLE_STATUSES as unknown as import('@maintenance-factory/types').TaskStatus[],
  );

  return items
    .filter((item) => item.agentEligible && item.scheduledEligible)
    .map((item) => ({
      projectItem: item,
      lockKey: buildItemLockKey(item),
    }));
}

function buildItemLockKey(item: ProjectItem): string {
  return `run:${item.repoFullName}:${item.maintenanceType}:${item.compositeKey}`;
}
