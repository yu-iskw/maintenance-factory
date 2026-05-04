import { describe, expect, it } from 'vitest';

import { reconcileCheckRunEvent } from './check-run.js';

describe('reconcileCheckRunEvent', () => {
  it('extracts check run metadata', () => {
    const result = reconcileCheckRunEvent({
      repository: { full_name: 'acme/a' },
      check_run: {
        id: 1,
        name: 'ci',
        status: 'completed',
        conclusion: 'failure',
        pull_requests: [{ number: 12, url: 'https://example/pr/12' }],
      },
    });
    expect(result?.repoFullName).toBe('acme/a');
    expect(result?.checkRunId).toBe(1);
    expect(result?.prNumber).toBe(12);
  });
});
