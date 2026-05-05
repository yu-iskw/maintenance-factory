import type { Octokit } from '@octokit/rest';

export interface RepoInventoryEntry {
  fullName: string;
  archived: boolean;
  defaultBranch: string | null;
  name: string;
  ownerLogin: string;
}

type RestRepo = {
  full_name: string;
  archived?: boolean | null;
  default_branch?: string | null;
  name: string;
  owner?: { login?: string | null } | null;
};

/** `fallbackOwnerLogin` used when GitHub omits `owner.login` (e.g. org listing). */
function toRepoInventoryEntry(r: RestRepo, fallbackOwnerLogin: string): RepoInventoryEntry {
  return {
    fullName: r.full_name,
    archived: Boolean(r.archived),
    defaultBranch: r.default_branch ?? null,
    name: r.name,
    ownerLogin: r.owner?.login ?? fallbackOwnerLogin,
  };
}

/**
 * List repositories for an organization (first page only for shallow scans).
 */
export async function listOrgRepositoriesPage(
  octokit: Octokit,
  org: string,
  page = 1,
  perPage = 100,
): Promise<RepoInventoryEntry[]> {
  const { data } = await octokit.rest.repos.listForOrg({
    org,
    type: 'all',
    per_page: perPage,
    page,
    sort: 'updated',
  });
  return data.map((r) => toRepoInventoryEntry(r, org));
}

/**
 * Full organization inventory (paginated) for FR-001 at 100+ repos.
 */
export async function listAllOrgRepositories(
  octokit: Octokit,
  org: string,
): Promise<RepoInventoryEntry[]> {
  const out: RepoInventoryEntry[] = [];
  for await (const { data } of octokit.paginate.iterator(octokit.rest.repos.listForOrg, {
    org,
    type: 'all',
    per_page: 100,
    sort: 'updated',
  })) {
    for (const r of data) {
      out.push(toRepoInventoryEntry(r, org));
    }
  }
  return out;
}

/**
 * Full installation-scoped inventory (paginated).
 */
export async function listAllInstallationRepositories(
  octokit: Octokit,
): Promise<RepoInventoryEntry[]> {
  const out: RepoInventoryEntry[] = [];
  for await (const { data } of octokit.paginate.iterator(
    octokit.rest.apps.listReposAccessibleToInstallation,
    {
      per_page: 100,
    },
  )) {
    for (const r of data) {
      out.push(toRepoInventoryEntry(r, ''));
    }
  }
  return out;
}

/**
 * List repositories accessible to an installation token.
 */
export async function listInstallationRepositoriesPage(
  octokit: Octokit,
  page = 1,
  perPage = 100,
): Promise<RepoInventoryEntry[]> {
  const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
    per_page: perPage,
    page,
  });
  return data.repositories.map((r) => toRepoInventoryEntry(r, ''));
}
