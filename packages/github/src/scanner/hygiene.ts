import { httpStatusFromUnknown } from './octokit-error.js';

import type { Octokit } from '@octokit/rest';

export interface HygieneFinding {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

async function pathExists(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
): Promise<boolean> {
  try {
    await octokit.rest.repos.getContent({ owner, repo, path });
    return true;
  } catch (e: unknown) {
    const status = httpStatusFromUnknown(e);
    if (status === 404) {
      return false;
    }
    throw e;
  }
}

/**
 * Read-only hygiene checks that do not mutate the repository.
 */
export async function scanRepoHygiene(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<HygieneFinding[]> {
  const findings: HygieneFinding[] = [];
  const [hasCodeowners, hasDependabotConfig] = await Promise.all([
    pathExists(octokit, owner, repo, '.github/CODEOWNERS'),
    pathExists(octokit, owner, repo, '.github/dependabot.yml'),
  ]);
  if (!hasCodeowners) {
    findings.push({
      code: 'missing_codeowners',
      message: 'No .github/CODEOWNERS file found',
      severity: 'warning',
    });
  }
  if (!hasDependabotConfig) {
    findings.push({
      code: 'missing_dependabot_yml',
      message: 'No .github/dependabot.yml found',
      severity: 'info',
    });
  }
  return findings;
}
