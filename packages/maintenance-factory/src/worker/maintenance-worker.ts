import type { RepoCriticality, RiskLevel, TaskType } from '../types/domain.js';

export type WorkerLaunchInput = {
  runUuid: string;
  repoFullName: string;
  taskType: TaskType;
  risk: RiskLevel;
  repoCriticality: RepoCriticality;
  taskTitle: string;
  taskBody: string;
  promptTemplateVersion: string;
  dryRun: boolean;
};

export type WorkerLaunchResult = {
  cursorRunId: string;
  dryRun: boolean;
};

export interface MaintenanceWorker {
  launch(input: WorkerLaunchInput): Promise<WorkerLaunchResult>;
}
