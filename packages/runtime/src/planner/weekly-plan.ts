import { inferRepeatedFailurePatterns, type AgentRunFailureRow } from './failure-patterns.js';

import type { MaintenanceTask } from '@maintenance-factory/core';

export interface WeeklyPlanInput {
  weekLabel: string;
  tasks: MaintenanceTask[];
  /** Count of agent runs in the window (success / fail) */
  agentRuns: { success: number; failure: number };
  /** Optional repeated failure hints */
  repeatedFailures?: string[];
  /** When set, FR-018 failure patterns are merged with `repeatedFailures`. */
  agentRunFailureRows?: AgentRunFailureRow[];
}

function buildRiskSectionLines(input: WeeklyPlanInput): string[] {
  const inferred =
    input.agentRunFailureRows !== undefined
      ? inferRepeatedFailurePatterns(input.agentRunFailureRows)
      : [];
  const merged = [...(input.repeatedFailures ?? []), ...inferred];
  const unique = [...new Set(merged)];
  return unique.length > 0 ? unique.map((r) => `- ${r}`) : ['- (none flagged)'];
}

function summarizeTasks(tasks: MaintenanceTask[]): {
  critical: number;
  high: number;
  medium: number;
  low: number;
  staleDependabot: number;
} {
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;
  let staleDependabot = 0;
  for (const t of tasks) {
    if (t.severity === 'Critical') {
      critical += 1;
    } else if (t.severity === 'High') {
      high += 1;
    } else if (t.severity === 'Medium') {
      medium += 1;
    } else if (t.severity === 'Low') {
      low += 1;
    }
    if (t.taskType === 'dependabot_shepherd' && t.status === 'Blocked') {
      staleDependabot += 1;
    }
  }
  return { critical, high, medium, low, staleDependabot };
}

/**
 * Produce a human-readable weekly maintenance plan (RFC §13.3 style).
 * Hermes does not mutate GitHub; operators paste or file this as a report.
 */
export function generateWeeklyPlanMarkdown(input: WeeklyPlanInput): string {
  const { critical, high, medium, low, staleDependabot } = summarizeTasks(input.tasks);
  const lines: string[] = [
    `# Weekly Maintenance Plan — ${input.weekLabel}`,
    '',
    '## Summary',
    `- Open tasks sampled: ${input.tasks.length}`,
    `- Critical: ${critical}, High: ${high}, Medium: ${medium}, Low: ${low}`,
    `- Blocked Dependabot-style tasks: ${staleDependabot}`,
    `- Agent runs: ${input.agentRuns.success} succeeded, ${input.agentRuns.failure} failed`,
    '',
    '## Recommended next actions',
    '- Shepherd blocked Dependabot PRs in standard repos first.',
    '- Triage direct_security_patch tasks with advisory references.',
    '- Refresh repo profiles missing test commands.',
    '',
    '## Risks',
    ...buildRiskSectionLines(input),
    '',
    '## Suggested policy changes',
    '- Keep major upgrades manual-only.',
    '- Pause scheduled runs when kill switches are active.',
    '',
  ];
  return lines.join('\n');
}
