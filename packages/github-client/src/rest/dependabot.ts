import type { Octokit } from 'octokit';

import type { DependabotAlert } from '@maintenance-factory/types';

export async function listDependabotAlerts(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<DependabotAlert[]> {
  const alerts: DependabotAlert[] = [];
  try {
    for await (const { data } of octokit.paginate.iterator(
      octokit.rest.dependabot.listAlertsForRepo,
      { owner, repo, state: 'open', per_page: 100 },
    )) {
      for (const a of data) {
        alerts.push({
          number: a.number,
          state: a.state as DependabotAlert['state'],
          severity: (a.security_advisory.severity as DependabotAlert['severity']) ?? 'low',
          packageName: a.dependency.package?.name ?? '',
          packageEcosystem: a.dependency.package?.ecosystem ?? '',
          manifestPath: a.dependency.manifest_path ?? '',
          fixedIn: a.security_vulnerability.first_patched_version?.identifier,
          advisoryUrl: a.security_advisory.permalink ?? undefined,
          htmlUrl: a.html_url,
          createdAt: new Date(a.created_at),
          updatedAt: new Date(a.updated_at),
        });
      }
    }
  } catch {
    // permissions may not allow dependabot alert access
  }
  return alerts;
}

export async function listDependabotPRs(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<Array<{ number: number; title: string; url: string; createdAt: Date; updatedAt: Date }>> {
  const prs = [];
  for await (const { data } of octokit.paginate.iterator(octokit.rest.pulls.list, {
    owner,
    repo,
    state: 'open',
    per_page: 100,
  })) {
    for (const pr of data) {
      if (pr.user?.login === 'dependabot[bot]' || pr.user?.type === 'Bot') {
        prs.push({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          createdAt: new Date(pr.created_at),
          updatedAt: new Date(pr.updated_at),
        });
      }
    }
  }
  return prs;
}
