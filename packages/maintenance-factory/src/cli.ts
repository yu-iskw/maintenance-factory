#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

import { applySchema } from './db/migrate.js';
import { MaintenanceStore } from './db/store.js';
import { createInstallationOctokit } from './github/app-auth.js';
import { listInstallationRepositories } from './github/scanner.js';
import { loadPolicyFromYamlFile } from './policy/policy-document.js';
import { MaintenanceScheduler } from './scheduler/scheduler.js';
import { startWebhookServer } from './webhook/server.js';
import { StubCursorWorker } from './worker/stub-cursor-worker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function usage(): never {
  console.error(`Usage:
  maintenance-factory migrate
  maintenance-factory serve-webhook --port 8787
  maintenance-factory scan-repos --installation-id <id> [--dry-run]
  maintenance-factory schedule-sample [--policy <path>]
  maintenance-factory pause --scope global|repo:<full>|task:<type>
  maintenance-factory resume --scope <same>
`);
  process.exit(1);
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) {
    return undefined;
  }
  return process.argv.at(idx + 1);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function requireEnv(name: string): string {
  // eslint-disable-next-line security/detect-object-injection -- env keys are fixed literals from callers
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function cmdMigrate(): Promise<void> {
  const connectionString = requireEnv('DATABASE_URL');
  const pool = new Pool({ connectionString });
  try {
    const client = await pool.connect();
    try {
      await applySchema(client);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
  console.log('migrate: ok');
}

async function cmdServeWebhook(): Promise<void> {
  const port = Number(getArg('--port') ?? '8787');
  const secret = requireEnv('GITHUB_WEBHOOK_SECRET');
  const server = await startWebhookServer({
    port,
    secret,
    onEvent: async (event, body) => {
      console.log(`webhook: ${event}`, summarizeWebhook(event, body));
    },
  });
  console.log(`webhook server listening on :${port}`);
  process.on('SIGINT', () => {
    void server.close().then(() => process.exit(0));
  });
}

function summarizeWebhook(event: string, body: unknown): string {
  if (typeof body !== 'object' || body === null) {
    return '';
  }
  const record = body as Record<string, unknown>;
  if (event === 'pull_request') {
    const pr = record.pull_request as Record<string, unknown> | undefined;
    const repo = record.repository as Record<string, unknown> | undefined;
    return `${String(repo?.full_name ?? '')}#${String(pr?.number ?? '')}`;
  }
  return '';
}

async function cmdScanRepos(): Promise<void> {
  const installationId = Number(getArg('--installation-id'));
  if (!Number.isFinite(installationId)) {
    throw new Error('--installation-id is required');
  }
  const dryRun = hasFlag('--dry-run');
  const creds = {
    appId: requireEnv('GITHUB_APP_ID'),
    privateKey: requireEnv('GITHUB_APP_PRIVATE_KEY'),
    clientId: process.env.GITHUB_APP_CLIENT_ID,
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
  };
  const octokit = await createInstallationOctokit(creds, installationId);
  const repos = await listInstallationRepositories(octokit);
  console.log(JSON.stringify({ dryRun, repoCount: repos.length, sample: repos.slice(0, 5) }, null, 2));

  if (dryRun) {
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return;
  }
  const pool = new Pool({ connectionString });
  const store = new MaintenanceStore(pool);
  try {
    for (const repo of repos) {
      if (repo.archived) {
        continue;
      }
      await store.upsertRepoProfile({
        repoFullName: repo.fullName,
        defaultBranch: repo.defaultBranch ?? undefined,
        repoCriticality: 'standard',
      });
    }
  } finally {
    await pool.end();
  }
}

async function cmdPauseResume(mode: 'pause' | 'resume'): Promise<void> {
  const scope = getArg('--scope');
  if (!scope) {
    throw new Error('--scope is required');
  }
  const connectionString = requireEnv('DATABASE_URL');
  const pool = new Pool({ connectionString });
  const store = new MaintenanceStore(pool);
  try {
    await store.setKillSwitch(scope, mode === 'pause');
  } finally {
    await pool.end();
  }
  console.log(`${mode}: scope=${scope}`);
}

async function cmdScheduleSample(): Promise<void> {
  const policyPath =
    getArg('--policy') ?? join(__dirname, '..', 'policy', 'default-policy.yaml');
  const policy = loadPolicyFromYamlFile(policyPath);
  const connectionString = requireEnv('DATABASE_URL');
  const pool = new Pool({ connectionString });
  const store = new MaintenanceStore(pool);
  const scheduler = new MaintenanceScheduler(policy, 'file:default-policy.yaml', store, new StubCursorWorker(), 'v1');
  const tasks = [
    {
      idempotencyKey: 'k1',
      githubProjectItemId: 'PVTI_1',
      repoFullName: 'acme/service',
      taskType: 'dependabot_shepherd' as const,
      workflowStatus: 'ready' as const,
      risk: 'low' as const,
      repoCriticality: 'standard' as const,
      agentEligible: true,
      scheduledEligible: true,
      agentStatus: 'not_run' as const,
      retryCount: 0,
      hasConflictingOpenPr: false,
      hasActiveRunForRepoTask: false,
      repoArchived: false,
      repoInstalled: true,
      repoProfileExists: true,
      ownerTeam: 'platform',
    },
  ];
  try {
    const result = await scheduler.scheduleNext(tasks);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (!cmd) {
    usage();
  }
  switch (cmd) {
    case 'migrate': {
      await cmdMigrate();
      return;
    }
    case 'serve-webhook': {
      await cmdServeWebhook();
      return;
    }
    case 'scan-repos': {
      await cmdScanRepos();
      return;
    }
    case 'pause': {
      await cmdPauseResume('pause');
      return;
    }
    case 'resume': {
      await cmdPauseResume('resume');
      return;
    }
    case 'schedule-sample': {
      await cmdScheduleSample();
      return;
    }
    default: {
      usage();
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
