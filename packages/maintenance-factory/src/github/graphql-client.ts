import { graphql } from '@octokit/graphql';

import { createInstallationToken } from './app-auth.js';

import type { GitHubAppCredentials } from './app-auth.js';

export async function createInstallationGraphql(
  creds: GitHubAppCredentials,
  installationId: number,
): Promise<ReturnType<typeof graphql.defaults>> {
  const token = await createInstallationToken(creds, installationId);
  return graphql.defaults({
    headers: { authorization: `token ${token}` },
  });
}
