import type { RepoMetadata } from '@maintenance-factory/types';
import type { Octokit } from 'octokit';

export async function getRepo(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoMetadata> {
  const { data } = await octokit.rest.repos.get({ owner, repo });
  return {
    id: data.id,
    fullName: data.full_name,
    owner: data.owner.login,
    name: data.name,
    defaultBranch: data.default_branch,
    language: data.language ?? null,
    isArchived: data.archived,
    isPrivate: data.private,
    visibility: (data.visibility as RepoMetadata['visibility']) ?? 'private',
    topics: data.topics ?? [],
    pushedAt: data.pushed_at ? new Date(data.pushed_at) : null,
    updatedAt: new Date(data.updated_at),
  };
}

export async function listOrgRepos(octokit: Octokit, org: string): Promise<RepoMetadata[]> {
  const repos: RepoMetadata[] = [];
  for await (const { data } of octokit.paginate.iterator(octokit.rest.repos.listForOrg, {
    org,
    type: 'all',
    per_page: 100,
  })) {
    for (const r of data) {
      repos.push({
        id: r.id,
        fullName: r.full_name,
        owner: r.owner.login,
        name: r.name,
        defaultBranch: r.default_branch,
        language: r.language ?? null,
        isArchived: r.archived,
        isPrivate: r.private,
        visibility: (r.visibility as RepoMetadata['visibility']) ?? 'private',
        topics: r.topics ?? [],
        pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
        updatedAt: new Date(r.updated_at),
      });
    }
  }
  return repos;
}

export async function hasCodeownersFile(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<boolean> {
  for (const path of ['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS']) {
    try {
      await octokit.rest.repos.getContent({ owner, repo, path });
      return true;
    } catch {
      // not found, try next
    }
  }
  return false;
}
