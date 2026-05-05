import { computeIdempotencyKey, type MaintenanceTask } from '@maintenance-factory/core';

import { listOpenDependabotPulls } from './dependabot.js';
import { scanRepoHygiene, type HygieneFinding } from './hygiene.js';
import { httpStatusFromUnknown } from './octokit-error.js';

import type { Octokit } from '@octokit/rest';

export interface DryScanResult {
  repoFullName: string;
  tasks: MaintenanceTask[];
  hygieneFindings: HygieneFinding[];
  dependabotAlertError?: string;
}

/**
 * Aggregate dry-run scan for one repository (no Project writes).
 */
export async function dryScanRepository(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<DryScanResult> {
  const repoFullName = `${owner}/${repo}`;
  const [dependabotTasks, hygieneFindings] = await Promise.all([
    listOpenDependabotPulls(octokit, owner, repo),
    scanRepoHygiene(octokit, owner, repo),
  ]);

  const tasks: MaintenanceTask[] = [...dependabotTasks];

  let dependabotAlertError: string | undefined;
  try {
    for await (const { data: alerts } of octokit.paginate.iterator(
      octokit.rest.dependabot.listAlertsForRepo,
      {
        owner,
        repo,
        per_page: 30,
        state: 'open',
      },
    )) {
      for (const alert of alerts) {
        const externalId = `alert-${alert.number}`;
        const severity = mapSeverity(alert.security_advisory?.severity);
        tasks.push({
          idempotencyKey: computeIdempotencyKey(repoFullName, 'direct_security_patch', externalId),
          repoFullName,
          taskType: 'direct_security_patch',
          externalId,
          title: alert.security_advisory?.summary ?? `Dependabot alert #${alert.number}`,
          severity,
          risk: mapRiskFromSeverity(severity),
          repoCriticality: 'standard',
          ecosystem: 'unknown',
          agentEligible: false,
          scheduledEligible: false,
          status: 'Inbox',
          agentStatus: 'NotRun',
          retryCount: 0,
        });
      }
    }
  } catch (e: unknown) {
    const status = httpStatusFromUnknown(e);
    if (status === 403 || status === 404 || status === 401) {
      dependabotAlertError = `dependabot_alerts_unavailable: HTTP ${String(status)}`;
    } else {
      throw e;
    }
  }

  return { repoFullName, tasks, hygieneFindings, dependabotAlertError };
}

function mapSeverity(
  s: string | null | undefined,
): 'Critical' | 'High' | 'Medium' | 'Low' | undefined {
  if (!s) {
    return undefined;
  }
  const normalized = s.toLowerCase();
  if (normalized === 'critical') {
    return 'Critical';
  }
  if (normalized === 'high') {
    return 'High';
  }
  if (normalized === 'medium' || normalized === 'moderate') {
    return 'Medium';
  }
  if (normalized === 'low') {
    return 'Low';
  }
  return undefined;
}

function mapRiskFromSeverity(
  sev: 'Critical' | 'High' | 'Medium' | 'Low' | undefined,
): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (sev === 'Critical') {
    return 'Critical';
  }
  if (sev === 'High') {
    return 'High';
  }
  if (sev === 'Medium') {
    return 'Medium';
  }
  return 'Low';
}
