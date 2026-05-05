/** RFC task taxonomy */
export const maintenanceTaskTypes = [
  'dependabot_shepherd',
  'direct_security_patch',
  'dependency_freshness_patch',
  'repo_hygiene_scan',
  'repo_hygiene_config_pr',
  'ci_diagnosis',
] as const;

export type MaintenanceTaskType = (typeof maintenanceTaskTypes)[number];

export const projectStatuses = [
  'Inbox',
  'Triaged',
  'Ready',
  'Queued',
  'AgentRunning',
  'PROpen',
  'NeedsReview',
  'Blocked',
  'Merged',
  'Snoozed',
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export const agentStatuses = [
  'NotRun',
  'Queued',
  'Running',
  'Succeeded',
  'Failed',
  'RetryNeeded',
] as const;

export type AgentStatus = (typeof agentStatuses)[number];

export const severityLevels = ['Critical', 'High', 'Medium', 'Low'] as const;
export type Severity = (typeof severityLevels)[number];

export const riskLevels = ['Low', 'Medium', 'High', 'Critical'] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const repoCriticalityLevels = ['standard', 'sensitive', 'critical'] as const;
export type RepoCriticality = (typeof repoCriticalityLevels)[number];

export const ecosystems = ['npm', 'pip', 'maven', 'go', 'docker', 'terraform', 'unknown'] as const;
export type Ecosystem = (typeof ecosystems)[number];

export type ReviewRequirement =
  | 'codeowners'
  | 'repo_owner'
  | 'platform_security'
  | 'senior_reviewer';

export interface RepoProfile {
  repoFullName: string;
  ownerTeam?: string;
  codeownersPresent: boolean;
  defaultBranch?: string;
  primaryLanguage?: string;
  packageManagers: string[];
  repoCriticality: RepoCriticality;
  testCommands: string[];
  buildCommands: string[];
  forbiddenPaths: string[];
  notes?: string;
}

export interface MaintenanceTask {
  idempotencyKey: string;
  repoFullName: string;
  taskType: MaintenanceTaskType;
  /** Dependabot PR number, alert id, or synthetic hygiene id */
  externalId: string;
  title: string;
  body?: string;
  severity?: Severity;
  risk: RiskLevel;
  repoCriticality: RepoCriticality;
  ecosystem: Ecosystem;
  agentEligible: boolean;
  scheduledEligible: boolean;
  status: ProjectStatus;
  agentStatus: AgentStatus;
  prUrl?: string;
  /** GitHub GraphQL global node id for the PR (used to link the PR to Projects v2). */
  prContentNodeId?: string;
  cursorRunId?: string;
  retryCount: number;
}
