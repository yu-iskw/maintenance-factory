/**
 * FR-016 — text/markdown “dashboard” slice operators can paste into docs or BI.
 * Values are caller-supplied aggregates (no GitHub queries here).
 */
export interface MaintenanceDashboardInput {
  title?: string;
  severityOpen: { Critical: number; High: number; Medium: number; Low: number };
  backlogAgeP50Days?: number;
  backlogAgeP90Days?: number;
  agentRuns7d?: {
    runs: number;
    prsOpened: number;
    successfulChecks: number;
    blocked: number;
    mergedByHumans: number;
  };
  topBlockers?: string[];
}

export function generateDashboardMarkdown(input: MaintenanceDashboardInput): string {
  const title = input.title ?? 'Security/Dependency Maintenance Dashboard';
  const lines: string[] = [
    `# ${title}`,
    '',
    '## Open backlog',
    `- Critical: ${input.severityOpen.Critical}`,
    `- High: ${input.severityOpen.High}`,
    `- Medium: ${input.severityOpen.Medium}`,
    `- Low: ${input.severityOpen.Low}`,
    '',
  ];
  if (input.backlogAgeP50Days !== undefined || input.backlogAgeP90Days !== undefined) {
    lines.push('## Backlog age', '');
    if (input.backlogAgeP50Days !== undefined) {
      lines.push(`- p50: ${input.backlogAgeP50Days} days`);
    }
    if (input.backlogAgeP90Days !== undefined) {
      lines.push(`- p90: ${input.backlogAgeP90Days} days`);
    }
    lines.push('');
  }
  if (input.agentRuns7d) {
    const a = input.agentRuns7d;
    lines.push(
      '## Agent activity last 7 days',
      '',
      `- Runs: ${a.runs}`,
      `- PRs opened: ${a.prsOpened}`,
      `- Successful checks: ${a.successfulChecks}`,
      `- Blocked: ${a.blocked}`,
      `- Merged by humans: ${a.mergedByHumans}`,
      '',
    );
  }
  lines.push('## Top blockers', '');
  if (input.topBlockers && input.topBlockers.length > 0) {
    for (const [i, blocker] of input.topBlockers.entries()) {
      lines.push(`${i + 1}. ${blocker}`);
    }
  } else {
    lines.push('(none listed)');
  }
  lines.push('');
  return lines.join('\n');
}
