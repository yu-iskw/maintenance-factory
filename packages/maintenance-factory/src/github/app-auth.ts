import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

export type GitHubAppCredentials = {
  appId: string;
  privateKey: string;
  clientId?: string;
  clientSecret?: string;
};

export async function createInstallationOctokit(
  creds: GitHubAppCredentials,
  installationId: number,
): Promise<Octokit> {
  const auth = createAppAuth({
    appId: creds.appId,
    privateKey: creds.privateKey,
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
  });

  const installationAuthentication = await auth({
    type: 'installation',
    installationId,
  });

  return new Octokit({ auth: installationAuthentication.token });
}
