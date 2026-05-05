import type { RepoProfile } from './hermes';
import type { TaskType } from './project';

export type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export type WorkerBackend = 'cursor' | 'copilot';

export type TriggerSource = 'scheduler' | 'webhook' | 'manual';

export interface AgentRun {
  id: string;
  projectItemId: string;
  repoFullName: string;
  taskType: TaskType;
  compositeKey: string;
  backend: WorkerBackend;
  status: RunStatus;
  triggerSource: TriggerSource;
  startedAt: Date;
  completedAt: Date | null;
  prUrl: string | null;
  branchName: string | null;
  filesChangedSummary: string | null;
  validationSummary: string | null;
  checkSummary: string | null;
  errorMessage: string | null;
  promptTemplateVersion: string;
}

export interface WorkerTask {
  projectItemId: string;
  repoFullName: string;
  taskType: TaskType;
  compositeKey: string;
  taskTitle: string;
  taskBody: string;
  risk: string;
  repoCriticality: string;
  allowedPaths?: string[];
  forbiddenPaths?: string[];
  validationCommands?: string[];
  repoProfile?: RepoProfile;
  promptTemplateVersion: string;
}

export interface WorkerResult {
  success: boolean;
  prUrl?: string;
  branchName?: string;
  filesChanged?: string[];
  validationSummary?: string;
  errorMessage?: string;
}
