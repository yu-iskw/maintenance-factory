import { describe, expect, it } from 'vitest';

import { generateDashboardMarkdown } from './dashboard.js';

describe('generateDashboardMarkdown', () => {
  it('renders RFC-style sections', () => {
    const md = generateDashboardMarkdown({
      severityOpen: { Critical: 1, High: 2, Medium: 3, Low: 4 },
      backlogAgeP50Days: 9,
      agentRuns7d: {
        runs: 10,
        prsOpened: 8,
        successfulChecks: 6,
        blocked: 1,
        mergedByHumans: 5,
      },
      topBlockers: ['Missing tests in Python repos'],
    });
    expect(md).toContain('Open backlog');
    expect(md).toContain('p50: 9');
    expect(md).toContain('Missing tests');
  });
});
