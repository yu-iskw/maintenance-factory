#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

import { applySchema } from './db/migrate.js';
import { MaintenanceStore } from './db/store.js';
import { createInstallationOctokit } from './github/app-auth.js';
import { createInstallationGraphql } from './github/graphql-client.js';
import { listInstallationRepositories } from './github/scanner.js';
import { loadHermesPortfolioSnapshot, renderWeeklyMaintenancePlan } from './hermes/week-plan.js';
import { loadPolicyFromYamlFile } from './policy/policy-document.js';
import { syncDependabotShepherdProjectItems, syncDirectSecurityPatchItems } from './projects/project-sync.js';
import { fetchProjectFieldCatalog } from './projects/v2-client.js';
import { MaintenanceScheduler } from './scheduler/scheduler.js';
import { startWebhookServer } from './webhook/server.js';
import { StubCursorWorker } from './worker/stub-cursor-worker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const INSTALLATION_ID_ARG = '--installation-id';

function usage(): never {
  console.error(`Usage:
  maintenance-factory migrate
  maintenance-factory serve-webhook --port 8787
  maintenance-factory scan-repos --installation-id <id> [--dry-run]
  maintenance-factory project-fetch-fields --org <login> --project-number <n> --installation-id <id>
  maintenance-factory scan-sync --org <login> --project-number <n> --installation-id <id> [--dry-run] [--focus dependabot|security|all]
  maintenance-factory schedule-sample [--policy <path>] [--dry-run]
  maintenance-factory hermes-weekly
  maintenance-factory metrics-rollup [--day YYYY-MM-DD]
  maintenance-factory pause --scope global|repo:<full>|task:<type>|eco:<name>|critical_repos|cursor_worker
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

function loadGitHubAppCreds(): {
  appId: string;
  privateKey: string;
  clientId?: string;
  clientSecret?: string;
} {
  return {
    appId: requireEnv('GITHUB_APP_ID'),
    privateKey: requireEnv('GITHUB_APP_PRIVATE_KEY'),
    clientId: process.env.GITHUB_APP_CLIENT_ID,
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
  };
}

function fieldIdsFromCatalog(catalog: { fieldsByName: Record<string, { fieldId: string }> }): Record<string, string> {
  return Object.fromEntries(Object.entries(catalog.fieldsByName).map(([name, meta]) => [name, meta.fieldId]));
}

async function withPool(connectionString: string, fn: (pool: Pool) => Promise<void>): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    await fn(pool);
  } finally {
    await pool.end();
  }
}

async function withMaintenanceStore(
  connectionString: string,
  fn: (store: MaintenanceStore) => Promise<void>,
): Promise<void> {
  await withPool(connectionString, async (pool) => {
    const store = new MaintenanceStore(pool);
    await fn(store);
  });
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
  const installationId = Number(getArg(INSTALLATION_ID_ARG));
  if (!Number.isFinite(installationId)) {
    throw new Error(`${INSTALLATION_ID_ARG} is required`);
  }
  const dryRun = hasFlag('--dry-run');
  const creds = loadGitHubAppCreds();
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
  await withMaintenanceStore(connectionString, async (store) => {
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
  });
}

async function cmdPauseResume(mode: 'pause' | 'resume'): Promise<void> {
  const scope = getArg('--scope');
  if (!scope) {
    throw new Error('--scope is required');
  }
  const connectionString = requireEnv('DATABASE_URL');
  await withMaintenanceStore(connectionString, async (store) => {
    await store.setKillSwitch(scope, mode === 'pause');
  });
  console.log(`${mode}: scope=${scope}`);
}

async function cmdScheduleSample(): Promise<void> {
  const policyPath =
    getArg('--policy') ?? join(__dirname, '..', 'policy', 'default-policy.yaml');
  const policy = loadPolicyFromYamlFile(policyPath);
  const dryRun = hasFlag('--dry-run');
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
  const connectionString = requireEnv('DATABASE_URL');
  await withMaintenanceStore(connectionString, async (store) => {
    const scheduler = new MaintenanceScheduler(policy, 'file:default-policy.yaml', store, new StubCursorWorker(), 'v1');
    const result = await scheduler.scheduleNext(tasks, { dryRun });
    console.log(JSON.stringify(result, null, 2));
  });
}

async function cmdProjectFetchFields(): Promise<void> {
  const org = getArg('--org');
  const projectNumber = Number(getArg('--project-number'));
  const installationId = Number(getArg(INSTALLATION_ID_ARG));
  if (!org || !Number.isFinite(projectNumber) || !Number.isFinite(installationId)) {
    throw new Error(`--org, --project-number, and ${INSTALLATION_ID_ARG} are required`);
  }
  const creds = loadGitHubAppCreds();
  const gql = await createInstallationGraphql(creds, installationId);
  const catalog = await fetchProjectFieldCatalog(gql, org, projectNumber);
  const fieldIds = fieldIdsFromCatalog(catalog);
  console.log(JSON.stringify({ projectNodeId: catalog.projectNodeId, fieldIds }, null, 2));

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return;
  }
  await withMaintenanceStore(connectionString, async (store) => {
    await store.upsertProjectsV2Config(catalog.projectNodeId, fieldIds);
    console.log('saved projects_v2_config');
  });
}

async function cmdScanSync(): Promise<void> {
  const org = getArg('--org');
  const projectNumber = Number(getArg('--project-number'));
  const installationId = Number(getArg(INSTALLATION_ID_ARG));
  const focus = getArg('--focus') ?? 'all';
  if (!org || !Number.isFinite(projectNumber) || !Number.isFinite(installationId)) {
    throw new Error(`--org, --project-number, and ${INSTALLATION_ID_ARG} are required`);
  }
  const dryRun = hasFlag('--dry-run');
  const creds = loadGitHubAppCreds();
  const gql = await createInstallationGraphql(creds, installationId);
  const octokit = await createInstallationOctokit(creds, installationId);
  const catalog = await fetchProjectFieldCatalog(gql, org, projectNumber);
  const repos = await listInstallationRepositories(octokit);
  const repoFullNames = repos.filter((r) => !r.archived).map((r) => r.fullName);

  const connectionString = requireEnv('DATABASE_URL');
  await withMaintenanceStore(connectionString, async (store) => {
    const fieldIds = fieldIdsFromCatalog(catalog);
    await store.upsertProjectsV2Config(catalog.projectNodeId, fieldIds);

    const results: Record<string, unknown> = {};
    if (focus === 'all' || focus === 'dependabot') {
      results.dependabot = await syncDependabotShepherdProjectItems({
        gql,
        octokit,
        catalog,
        store,
        repoFullNames,
        dryRun,
      });
    }
    if (focus === 'all' || focus === 'security') {
      results.security = await syncDirectSecurityPatchItems({
        gql,
        octokit,
        catalog,
        store,
        repoFullNames,
        dryRun,
      });
    }
    console.log(JSON.stringify({ dryRun, focus, results }, null, 2));
  });
}

async function cmdHermesWeekly(): Promise<void> {
  const connectionString = requireEnv('DATABASE_URL');
  await withPool(connectionString, async (pool) => {
    const snapshot = await loadHermesPortfolioSnapshot(pool);
    const body = renderWeeklyMaintenancePlan(snapshot);
    const weekStart = new Date();
    weekStart.setUTCHours(0, 0, 0, 0);
    const store = new MaintenanceStore(pool);
    await store.insertHermesWeeklyPlan(weekStart, body);
    console.log(body);
  });
}

async function cmdMetricsRollup(): Promise<void> {
  const dayArg = getArg('--day');
  const day = dayArg ? new Date(`${dayArg}T00:00:00.000Z`) : new Date();
  day.setUTCHours(0, 0, 0, 0);
  const connectionString = requireEnv('DATABASE_URL');
  await withMaintenanceStore(connectionString, async (store) => {
    await store.rollupMetricsForDay(day);
    const rows = await store.listMetricsDaily(14);
    console.log(JSON.stringify({ day: day.toISOString().slice(0, 10), rows }, null, 2));
  });
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
    case 'project-fetch-fields': {
      await cmdProjectFetchFields();
      return;
    }
    case 'scan-sync': {
      await cmdScanSync();
      return;
    }
    case 'hermes-weekly': {
      await cmdHermesWeekly();
      return;
    }
    case 'metrics-rollup': {
      await cmdMetricsRollup();
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
