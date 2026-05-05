import { describe, expect, it } from 'vitest';

import { generateWeeklyPlanMarkdown } from './weekly-plan.js';

import type { MaintenanceTask } from '@maintenance-factory/core';

describe('generateWeeklyPlanMarkdown', () => {
  it('includes summary counts', () => {
    const tasks: MaintenanceTask[] = [
      {
        idempotencyKey: '1',
        repoFullName: 'o/r',
        taskType: 'dependabot_shepherd',
        externalId: '1',
        title: 'x',
        severity: 'High',
        risk: 'Medium',
        repoCriticality: 'standard',
        ecosystem: 'npm',
        agentEligible: true,
        scheduledEligible: true,
        status: 'Blocked',
        agentStatus: 'Failed',
        retryCount: 0,
      },
    ];
    const md = generateWeeklyPlanMarkdown({
      weekLabel: '2026-W01',
      tasks,
      agentRuns: { success: 2, failure: 1 },
      repeatedFailures: ['pnpm lockfile conflicts in o/r'],
    });
    expect(md).toContain('2026-W01');
    expect(md).toContain('pnpm lockfile');
  });

  it('merges inferred failure patterns from agent run rows', () => {
    const md = generateWeeklyPlanMarkdown({
      weekLabel: '2026-W02',
      tasks: [],
      agentRuns: { success: 0, failure: 2 },
      agentRunFailureRows: [
        {
          repoFullName: 'o/x',
          taskType: 'ci_diagnosis',
          status: 'Failed',
          errorSummary: 'timeout',
        },
        {
          repoFullName: 'o/x',
          taskType: 'ci_diagnosis',
          status: 'Failed',
          errorSummary: 'timeout',
        },
      ],
    });
    expect(md).toContain('o/x');
    expect(md).toContain('2× failures');
  });
});
