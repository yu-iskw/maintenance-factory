import { describe, expect, it } from 'vitest';

import { inferRepeatedFailurePatterns } from './failure-patterns.js';

describe('inferRepeatedFailurePatterns', () => {
  it('returns empty when below threshold', () => {
    expect(
      inferRepeatedFailurePatterns([
        { repoFullName: 'o/a', taskType: 'ci_diagnosis', status: 'Failed', errorSummary: 'x' },
      ]),
    ).toEqual([]);
  });

  it('groups repeated failures by repo, task type, and error prefix', () => {
    const rows = [
      {
        repoFullName: 'o/pay',
        taskType: 'dependabot_shepherd',
        status: 'Failed',
        errorSummary: 'lockfile conflict',
      },
      {
        repoFullName: 'o/pay',
        taskType: 'dependabot_shepherd',
        status: 'Failed',
        errorSummary: 'lockfile conflict',
      },
      {
        repoFullName: 'o/other',
        taskType: 'dependabot_shepherd',
        status: 'Failed',
        errorSummary: 'lockfile conflict',
      },
    ];
    const p = inferRepeatedFailurePatterns(rows);
    expect(p.some((l) => l.includes('o/pay') && l.includes('2×'))).toBe(true);
    expect(p.some((l) => l.includes('o/other'))).toBe(false);
  });
});
