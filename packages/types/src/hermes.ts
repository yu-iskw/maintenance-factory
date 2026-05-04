export interface RepoProfile {
  repoFullName: string;
  ownerTeam?: string;
  repoCriticality: 'standard' | 'sensitive' | 'critical';
  primaryLanguage?: string;
  packageManagers?: string[];
  runtime?: Record<string, string>;
  ciProvider?: string;
  testCommands?: string[];
  buildCommands?: string[];
  forbiddenPaths?: string[];
  notes?: string[];
  updatedAt: Date;
}

export interface FailurePattern {
  pattern: string;
  count: number;
  affectedRepos: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface WeeklySummary {
  generatedAt: Date;
  openTaskCount: number;
  highSeverityCount: number;
  staleDependabotPrCount: number;
  criticalRepoAlertCount: number;
  reposMissingCodeowners: number;
  recommendedRuns: Array<{
    description: string;
    repoFullName: string;
    taskType: string;
    priority: number;
  }>;
  risks: string[];
  suggestedPolicyChanges: string[];
  failurePatterns: FailurePattern[];
}
