import type { Octokit } from '@octokit/rest';

export type RepoInventoryRow = {
  fullName: string;
  defaultBranch: string | null;
  archived: boolean;
  pushedAt: string | null;
};

export async function listInstallationRepositories(octokit: Octokit): Promise<RepoInventoryRow[]> {
  const rows: RepoInventoryRow[] = [];
  for await (const response of octokit.paginate.iterator(octokit.rest.apps.listReposAccessibleToInstallation, {
    per_page: 100,
  })) {
    const data = response.data as { repositories?: Array<Record<string, unknown>> };
    const repos = data.repositories ?? [];
    for (const repo of repos) {
      const fullName = String(repo.full_name ?? '');
      if (!fullName) {
        continue;
      }
      rows.push({
        fullName,
        defaultBranch: repo.default_branch ? String(repo.default_branch) : null,
        archived: Boolean(repo.archived),
        pushedAt: repo.pushed_at ? String(repo.pushed_at) : null,
      });
    }
  }
  return rows;
}

export async function listOpenPullRequests(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<
  Array<{
    number: number;
    title: string;
    headRef: string;
    userLogin: string | null;
    updatedAt: string | null;
  }>
> {
  const pulls = await octokit.paginate(octokit.rest.pulls.list, {
    owner,
    repo,
    state: 'open',
    per_page: 100,
  });
  return pulls.map((pr) => ({
    number: pr.number,
    title: pr.title,
    headRef: pr.head.ref,
    userLogin: pr.user?.login ?? null,
    updatedAt: pr.updated_at,
  }));
}

export function isLikelyDependabotPr(pr: { userLogin: string | null; title: string }): boolean {
  const login = pr.userLogin?.toLowerCase() ?? '';
  if (login.includes('dependabot')) {
    return true;
  }
  const title = pr.title.toLowerCase();
  return title.includes('dependabot') || title.includes('bump ');
}
