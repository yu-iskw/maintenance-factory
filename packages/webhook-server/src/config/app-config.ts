import { z } from 'zod';

import type { AppConfig } from '@maintenance-factory/types';

const appConfigSchema = z.object({
  GITHUB_APP_ID: z.string().transform(Number),
  GITHUB_PRIVATE_KEY: z.string(),
  GITHUB_WEBHOOK_SECRET: z.string(),
  GITHUB_ORG: z.string(),
  GITHUB_PROJECT_ID: z.string(),
  DATABASE_URL: z.string(),
  POLICY_FILE_PATH: z.string().default('./policy.yaml'),
  PORT: z.string().transform(Number).default('3000'),
  CURSOR_API_KEY: z.string().optional(),
  CURSOR_API_BASE_URL: z.string().default('https://api.cursor.sh'),
  ANTHROPIC_API_KEY: z.string(),
  WORKER_BACKEND: z.enum(['cursor', 'copilot', 'both']).default('cursor'),
  SCHEDULER_CRON: z.string().default('0 * * * *'),
  MAX_GLOBAL_CONCURRENT_RUNS: z.string().transform(Number).default('5'),
  MAX_RUNS_PER_REPO: z.string().transform(Number).default('1'),
  MAX_RUNS_PER_TEAM: z.string().transform(Number).default('2'),
  MAX_DAILY_RUNS: z.string().transform(Number).default('30'),
  LOCK_TTL_HOURS: z.string().transform(Number).default('2'),
  SCHEDULER_ENABLED: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  DRY_RUN: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export function loadAppConfig(): AppConfig {
  const parsed = appConfigSchema.parse(process.env);
  return {
    githubAppId: parsed.GITHUB_APP_ID,
    githubPrivateKey: parsed.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
    githubWebhookSecret: parsed.GITHUB_WEBHOOK_SECRET,
    githubOrg: parsed.GITHUB_ORG,
    githubProjectId: parsed.GITHUB_PROJECT_ID,
    databaseUrl: parsed.DATABASE_URL,
    policyFilePath: parsed.POLICY_FILE_PATH,
    port: parsed.PORT,
    cursorApiKey: parsed.CURSOR_API_KEY,
    cursorApiBaseUrl: parsed.CURSOR_API_BASE_URL,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    workerBackend: parsed.WORKER_BACKEND,
    schedulerCron: parsed.SCHEDULER_CRON,
    maxGlobalConcurrentRuns: parsed.MAX_GLOBAL_CONCURRENT_RUNS,
    maxRunsPerRepo: parsed.MAX_RUNS_PER_REPO,
    maxRunsPerTeam: parsed.MAX_RUNS_PER_TEAM,
    maxDailyRuns: parsed.MAX_DAILY_RUNS,
    lockTtlHours: parsed.LOCK_TTL_HOURS,
    schedulerEnabled: parsed.SCHEDULER_ENABLED,
    dryRun: parsed.DRY_RUN,
    logLevel: parsed.LOG_LEVEL,
  };
}
