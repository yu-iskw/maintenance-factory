import { ensurePullRequestInProjectV2 } from './ensure-project-pr-item.js';

import type { GraphqlExecutor } from './projects-v2.js';
import type { MaintenanceTask } from '@maintenance-factory/core';

export interface SyncedDependabotProjectRow {
  idempotencyKey: string;
  projectItemNodeId?: string;
  skippedReason?: string;
}

/**
 * For each Dependabot shepherd task with a PR GraphQL node id, ensure the PR is linked to the Project (RFC §19.1).
 * Does not set custom fields — use `fieldUpdatesToProjectV2Mutations` with your field id map afterward.
 */
export async function syncDependabotShepherdTasksToProject(
  graphql: GraphqlExecutor,
  projectNodeId: string,
  tasks: MaintenanceTask[],
): Promise<SyncedDependabotProjectRow[]> {
  const out: SyncedDependabotProjectRow[] = [];
  for (const t of tasks) {
    if (t.taskType !== 'dependabot_shepherd') {
      out.push({
        idempotencyKey: t.idempotencyKey,
        skippedReason: 'not_dependabot_shepherd',
      });
      continue;
    }
    if (!t.prContentNodeId) {
      out.push({
        idempotencyKey: t.idempotencyKey,
        skippedReason: 'missing_pr_content_node_id',
      });
      continue;
    }
    const projectItemNodeId = await ensurePullRequestInProjectV2(graphql, {
      projectNodeId,
      contentNodeId: t.prContentNodeId,
    });
    out.push({ idempotencyKey: t.idempotencyKey, projectItemNodeId });
  }
  return out;
}
