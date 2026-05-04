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
  } catch (error) {
    const status = getHttpStatus(error);
    if (status === 403 || status === 404) {
      return [];
    }
    throw error;
  }
}

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const record = error as { status?: unknown };
  return typeof record.status === 'number' ? record.status : undefined;
}
