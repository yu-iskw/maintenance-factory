import type { Octokit } from 'octokit';

import type { CodeScanningAlert } from '@maintenance-factory/types';

export async function listCodeScanningAlerts(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<CodeScanningAlert[]> {
  const alerts: CodeScanningAlert[] = [];
  try {
    for await (const { data } of octokit.paginate.iterator(
      octokit.rest.codeScanning.listAlertsForRepo,
      { owner, repo, state: 'open', per_page: 100 },
    )) {
      for (const a of data) {
        alerts.push({
          number: a.number,
          state: a.state as CodeScanningAlert['state'],
          severity: (a.rule.severity as CodeScanningAlert['severity']) ?? 'warning',
          ruleName: a.rule.name ?? a.rule.id ?? '',
          ruleDescription: a.rule.description ?? '',
          htmlUrl: a.html_url,
          createdAt: new Date(a.created_at),
          updatedAt: new Date(a.updated_at),
        });
      }
    }
  } catch {
    // permissions may not allow code scanning alert access
  }
  return alerts;
}
