import { createClient } from '@maintenance-factory/db';
import { createAppOctokit } from '@maintenance-factory/github-client';
import { loadPolicy } from '@maintenance-factory/policy';
import { startScheduler } from '@maintenance-factory/scheduler';

import { buildApp } from './app';
import { loadAppConfig } from './config/app-config';

async function main(): Promise<void> {
  const config = loadAppConfig();
  const db = createClient(config.databaseUrl);
  const octokit = createAppOctokit({
    appId: config.githubAppId,
    privateKey: config.githubPrivateKey,
    webhookSecret: config.githubWebhookSecret,
  });
  const policy = loadPolicy(config.policyFilePath);

  const reconcilerDeps = { octokit, projectId: config.githubProjectId };

  const schedulerHandle = startScheduler({ octokit, db, policy, config }, config.schedulerCron);

  const app = buildApp({ config, reconcilerDeps, schedulerHandle });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`Webhook server listening on port ${config.port}`);
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
