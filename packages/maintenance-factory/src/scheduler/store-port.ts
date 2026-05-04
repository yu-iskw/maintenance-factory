import type { AgentRunInsert } from '../db/store.js';

export type SchedulerStore = {
  isGlobalPaused(): Promise<boolean>;
  isRepoPaused(repoFullName: string): Promise<boolean>;
  isTaskTypePaused(taskType: string): Promise<boolean>;
  insertPolicyDecision(input: {
    githubProjectItemId?: string;
    repoFullName: string;
    taskType: string;
    decision: string;
    reason?: string;
    policyVersion: string;
  }): Promise<void>;
  countGlobalRunning(): Promise<number>;
  countRunsStartedToday(): Promise<number>;
  countRunningForRepo(repoFullName: string): Promise<number>;
  countRunningForOwnerTeam(ownerTeam: string): Promise<number>;
  countRunningForCriticalRepos(): Promise<number>;
  tryAcquireLock(
    key: string,
    repoFullName: string,
    projectItemId: string | undefined,
    ttlMs: number,
  ): Promise<boolean>;
  releaseLock(key: string): Promise<void>;
  insertAgentRun(row: AgentRunInsert): Promise<void>;
  updateAgentRunByUuid(
    runUuid: string,
    patch: Partial<{
      status: string;
      cursorRunId: string;
      errorSummary: string;
      completedAt: Date;
      prUrl: string;
      branchName: string;
    }>,
  ): Promise<void>;
};
