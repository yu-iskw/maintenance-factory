export type TaskType =
  | 'dependabot_shepherd'
  | 'direct_security_patch'
  | 'dependency_freshness_patch'
  | 'repo_hygiene_scan'
  | 'repo_hygiene_config_pr'
  | 'ci_diagnosis';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RepoCriticality = 'standard' | 'sensitive' | 'critical';

export type WorkflowStatus =
  | 'inbox'
  | 'triaged'
  | 'ready'
  | 'queued'
  | 'agent_running'
  | 'pr_open'
  | 'needs_review'
  | 'blocked'
  | 'merged'
  | 'snoozed';

export type AgentLifecycleStatus =
  | 'not_run'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'retry_needed';

export type PolicyDecision = 'allow' | 'deny' | 'defer';

export type PolicyEvaluation = {
  decision: PolicyDecision;
  reason?: string;
  policyVersion: string;
};

export type MaintenanceTaskInput = {
  idempotencyKey: string;
  githubProjectItemId?: string;
  repoFullName: string;
  taskType: TaskType;
  workflowStatus: WorkflowStatus;
  maintenanceType?: string;
  severity?: string;
  risk: RiskLevel;
  repoCriticality: RepoCriticality;
  ecosystem?: string;
  agentEligible: boolean;
  scheduledEligible: boolean;
  agentStatus: AgentLifecycleStatus;
  requiredReview?: string;
  prUrl?: string;
  prNumber?: number;
  advisoryReference?: string;
  dependencyScope?: string;
  ownerTeam?: string;
  openPrExternalId?: string;
  retryCount: number;
  hasConflictingOpenPr: boolean;
  hasActiveRunForRepoTask: boolean;
  repoArchived: boolean;
  repoInstalled: boolean;
  repoProfileExists: boolean;
  forbiddenPathMatch?: string;
};
