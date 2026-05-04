export interface DailyMetric {
  day: string;
  ownerTeam?: string;
  repoCriticality?: string;
  taskType?: string;
  openCount: number;
  mergedCount: number;
  blockedCount: number;
  agentRunCount: number;
  agentSuccessCount: number;
  agentFailureCount: number;
}

export type MetricKey =
  | 'open_tasks'
  | 'merged_prs'
  | 'blocked_tasks'
  | 'agent_runs'
  | 'agent_successes'
  | 'agent_failures'
  | 'stale_dependabot_prs'
  | 'open_security_alerts';
