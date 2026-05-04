import type { ProjectItem } from './project';

export interface SchedulerLock {
  lockKey: string;
  repoFullName: string;
  projectItemId: string;
  acquiredAt: Date;
  expiresAt: Date;
  acquiredBy: string;
}

export interface EligibleItem {
  projectItem: ProjectItem;
  lockKey: string;
}

export interface SchedulerConfig {
  cronExpression: string;
  maxGlobalConcurrentRuns: number;
  maxRunsPerRepo: number;
  maxRunsPerTeam: number;
  maxDailyRuns: number;
  lockTtlHours: number;
  enabled: boolean;
  dryRun: boolean;
}

export interface SchedulerTick {
  startedAt: Date;
  itemsConsidered: number;
  itemsLaunched: number;
  itemsSkippedByPolicy: number;
  itemsSkippedByLock: number;
  itemsSkippedByConcurrency: number;
  errors: string[];
}
