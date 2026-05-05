import type { PoolClient } from 'pg';

export interface PolicyDecisionInsert {
  githubProjectItemId: string;
  repoFullName: string;
  taskType: string;
  decision: string;
  reason?: string;
  policyVersion: string;
}

export async function insertPolicyDecision(
  client: PoolClient,
  row: PolicyDecisionInsert,
): Promise<void> {
  await client.query(
    `INSERT INTO policy_decisions (github_project_item_id, repo_full_name, task_type, decision, reason, policy_version)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      row.githubProjectItemId,
      row.repoFullName,
      row.taskType,
      row.decision,
      row.reason ?? null,
      row.policyVersion,
    ],
  );
}
