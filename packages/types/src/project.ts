export type TaskType =
  | 'dependabot_shepherd'
  | 'direct_security_patch'
  | 'dependency_freshness_patch'
  | 'repo_hygiene_scan'
  | 'repo_hygiene_config_pr'
  | 'ci_diagnosis';

export type TaskStatus =
  | 'Inbox'
  | 'Triaged'
  | 'Ready'
  | 'Queued'
  | 'Agent Running'
  | 'PR Open'
  | 'Needs Review'
  | 'Blocked'
  | 'Merged'
  | 'Snoozed';

export type AgentStatus =
  | 'Not Run'
  | 'Queued'
  | 'Running'
  | 'Succeeded'
  | 'Failed'
  | 'Retry Needed';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export type Risk = 'Low' | 'Medium' | 'High' | 'Critical';

export type RepoCriticality = 'standard' | 'sensitive' | 'critical';

export type Ecosystem = 'npm' | 'pip' | 'maven' | 'go' | 'docker' | 'terraform' | 'other';

export type RequiredReview = 'repo_owner' | 'codeowners' | 'platform' | 'security' | 'senior';

export interface ProjectItem {
  id: string;
  repoFullName: string;
  status: TaskStatus;
  maintenanceType: TaskType;
  severity: Severity;
  risk: Risk;
  repoCriticality: RepoCriticality;
  ecosystem?: Ecosystem;
  agentEligible: boolean;
  scheduledEligible: boolean;
  agentStatus: AgentStatus;
  requiredReview: RequiredReview[];
  compositeKey: string;
  prUrl?: string;
  cursorRunId?: string;
  lastRunSummary?: string;
  lastValidation?: string;
  blockedReason?: string;
  lastUpdatedBy?: 'Scanner' | 'Reconciler' | 'Human' | 'Hermes';
}
