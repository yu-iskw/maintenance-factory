import { Octokit } from 'octokit';

export interface GithubAppConfig {
  appId: number;
  privateKey: string;
  webhookSecret: string;
}

export function createAppOctokit(config: GithubAppConfig): Octokit {
  return new Octokit({
    authStrategy: require('@octokit/auth-app').createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
    },
  });
}

export async function createInstallationOctokit(
  appOctokit: Octokit,
  installationId: number,
): Promise<Octokit> {
  const { token } = (await appOctokit.auth({
    type: 'installation',
    installationId,
  })) as { token: string };

  return new Octokit({ auth: token });
}

export async function getInstallationForRepo(
  appOctokit: Octokit,
  owner: string,
  repo: string,
): Promise<number> {
  const { data } = await appOctokit.rest.apps.getRepoInstallation({ owner, repo });
  return data.id;
}
