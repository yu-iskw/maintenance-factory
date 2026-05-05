export type KillSwitchScope =
  | 'global'
  | 'repo'
  | 'task_type'
  | 'ecosystem'
  | 'critical_repo'
  | 'worker';

export interface KillSwitchRow {
  scope: KillSwitchScope;
  scopeKey: string;
  paused: boolean;
}

export interface KillSwitchEvaluationInput {
  repoFullName: string;
  taskType: string;
  ecosystem: string;
  repoCriticality: string;
  rows: KillSwitchRow[];
}

/**
 * Derive scheduler context flags from persisted kill-switch rows.
 */
export function evaluateKillSwitches(input: KillSwitchEvaluationInput): {
  killSwitchGlobalPause: boolean;
  killSwitchRepo: boolean;
  killSwitchTaskType: boolean;
  killSwitchEcosystem: boolean;
  killSwitchCriticalRepo: boolean;
  killSwitchWorkerDisabled: boolean;
} {
  const isPaused = (scope: KillSwitchScope, key = ''): boolean =>
    input.rows.some((r) => r.scope === scope && r.scopeKey === key && r.paused);

  return {
    killSwitchGlobalPause: isPaused('global', ''),
    killSwitchRepo: isPaused('repo', input.repoFullName.toLowerCase()),
    killSwitchTaskType: isPaused('task_type', input.taskType.toLowerCase()),
    killSwitchEcosystem: isPaused('ecosystem', input.ecosystem.toLowerCase()),
    killSwitchCriticalRepo: isPaused('critical_repo', '') && input.repoCriticality === 'critical',
    killSwitchWorkerDisabled: isPaused('worker', ''),
  };
}
