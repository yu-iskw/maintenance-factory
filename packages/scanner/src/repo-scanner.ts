import { hasCodeownersFile, listOrgRepos } from '@maintenance-factory/github-client';

import type { RepoMetadata } from '@maintenance-factory/types';
import type { Octokit } from 'octokit';

export interface RepoScanResult {
  repo: RepoMetadata;
  hasCodeowners: boolean;
  hasDependabotConfig: boolean;
}

export async function scanOrgRepos(octokit: Octokit, org: string): Promise<RepoMetadata[]> {
  return listOrgRepos(octokit, org);
}

export async function scanRepoHygiene(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoScanResult> {
  const repoMeta = await import('@maintenance-factory/github-client').then((m) =>
    m.getRepo(octokit, owner, repo),
  );
  const hasCodeowners = await hasCodeownersFile(octokit, owner, repo);

  let hasDependabotConfig = false;
  try {
    await octokit.rest.repos.getContent({
      owner,
      repo,
      path: '.github/dependabot.yml',
    });
    hasDependabotConfig = true;
  } catch {
    // not found
  }

  return { repo: repoMeta, hasCodeowners, hasDependabotConfig };
}
