import { assertNoTranscriptField, redactSummary } from '@maintenance-factory/core';

import type { PoolClient } from 'pg';

function prep(name: string, value: string | undefined): string | null {
  if (value === undefined || value === '') {
    return null;
  }
  assertNoTranscriptField(name, value);
  return redactSummary(value);
}

export interface AgentRunInsert {
  runUuid: string;
  githubProjectItemId: string;
  repoFullName: string;
  taskType: string;
  severity?: string;
  risk: string;
  repoCriticality: string;
  policyDecision: string;
  policyReason?: string;
  promptTemplateVersion: string;
  status: string;
  validationCommands: string[];
  cursorRunId?: string;
  branchName?: string;
  prUrl?: string;
  filesChangedSummary?: string;
  validationSummary?: string;
  checkSummary?: string;
  reviewerOutcome?: string;
  errorSummary?: string;
}

export interface AgentRunCompletionUpdate {
  status: string;
  cursorRunId?: string;
  errorSummary?: string;
}

export async function updateAgentRunCompletion(
  client: PoolClient,
  runUuid: string,
  update: AgentRunCompletionUpdate,
): Promise<void> {
  const cursorRunId = prep('cursor_run_id', update.cursorRunId);
  const errorSummary = prep('error_summary', update.errorSummary);
  await client.query(
    `UPDATE agent_runs
     SET status = $2,
         cursor_run_id = COALESCE($3, cursor_run_id),
         error_summary = COALESCE($4, error_summary),
         completed_at = now()
     WHERE run_uuid = $1`,
    [runUuid, update.status, cursorRunId, errorSummary],
  );
}

export async function insertAgentRun(client: PoolClient, row: AgentRunInsert): Promise<void> {
  const policyReason = prep('policy_reason', row.policyReason);
  const filesChangedSummary = prep('files_changed_summary', row.filesChangedSummary);
  const validationSummary = prep('validation_summary', row.validationSummary);
  const checkSummary = prep('check_summary', row.checkSummary);
  const reviewerOutcome = prep('reviewer_outcome', row.reviewerOutcome);
  const errorSummary = prep('error_summary', row.errorSummary);
  const cursorRunId = prep('cursor_run_id', row.cursorRunId);
  const branchName = prep('branch_name', row.branchName);
  const prUrl = prep('pr_url', row.prUrl);

  await client.query(
    `INSERT INTO agent_runs (
       run_uuid, github_project_item_id, repo_full_name, task_type, severity, risk, repo_criticality,
       policy_decision, policy_reason, prompt_template_version, cursor_run_id, branch_name, pr_url,
       status, files_changed_summary, validation_commands, validation_summary, check_summary,
       reviewer_outcome, error_summary, started_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, now())`,
    [
      row.runUuid,
      row.githubProjectItemId,
      row.repoFullName,
      row.taskType,
      row.severity ?? null,
      row.risk,
      row.repoCriticality,
      row.policyDecision,
      policyReason,
      row.promptTemplateVersion,
      cursorRunId,
      branchName,
      prUrl,
      row.status,
      filesChangedSummary,
      row.validationCommands,
      validationSummary,
      checkSummary,
      reviewerOutcome,
      errorSummary,
    ],
  );
}
