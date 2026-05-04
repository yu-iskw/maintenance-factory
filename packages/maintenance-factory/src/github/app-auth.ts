import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

export type GitHubAppCredentials = {
  appId: string;
  privateKey: string;
  clientId?: string;
  clientSecret?: string;
};

export async function createInstallationToken(creds: GitHubAppCredentials, installationId: number): Promise<string> {
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

  return installationAuthentication.token;
}

export async function createInstallationOctokit(
  creds: GitHubAppCredentials,
  installationId: number,
): Promise<Octokit> {
  const token = await createInstallationToken(creds, installationId);
  return new Octokit({ auth: token });
}
