import type { Octokit } from '@octokit/rest';

export type DependabotAlertSummary = {
  number: number;
  state: string;
  severity?: string;
  packageName?: string;
  ecosystem?: string;
};

export async function listDependabotAlerts(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<DependabotAlertSummary[]> {
  try {
    const alerts = await octokit.paginate(octokit.rest.dependabot.listAlertsForRepo, {
      owner,
      repo,
      per_page: 100,
      state: 'open',
    });
    return alerts.map((a) => ({
      number: a.number,
      state: a.state,
      severity: a.security_advisory?.severity,
      packageName: a.security_vulnerability?.package?.name,
      ecosystem: a.security_vulnerability?.package?.ecosystem,
    }));
  } catch {
    return [];
  }
}
