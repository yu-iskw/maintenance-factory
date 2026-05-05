import type { WorkerBackend } from './runs.js';

export interface AppConfig {
  githubAppId: number;
  githubPrivateKey: string;
  githubWebhookSecret: string;
  githubOrg: string;
  githubProjectId: string;
  databaseUrl: string;
  policyFilePath: string;
  port: number;
  cursorApiKey?: string;
  cursorApiBaseUrl: string;
  anthropicApiKey: string;
  workerBackend: WorkerBackend | 'both';
  schedulerCron: string;
  maxGlobalConcurrentRuns: number;
  maxRunsPerRepo: number;
  maxRunsPerTeam: number;
  maxDailyRuns: number;
  lockTtlHours: number;
  schedulerEnabled: boolean;
  dryRun: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
