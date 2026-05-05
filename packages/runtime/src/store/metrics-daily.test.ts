import { describe, expect, it, vi } from 'vitest';

import { upsertMetricsDaily } from './metrics-daily.js';

import type { PoolClient } from 'pg';

describe('upsertMetricsDaily', () => {
  it('issues upsert SQL with typed parameters', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const client = { query } as unknown as PoolClient;
    await upsertMetricsDaily(client, {
      day: '2026-05-04',
      ownerTeam: 'platform',
      repoCriticality: 'standard',
      taskType: 'dependabot_shepherd',
      openCount: 1,
      mergedCount: 2,
      blockedCount: 0,
      agentRunCount: 3,
      agentSuccessCount: 2,
      agentFailureCount: 1,
    });
    expect(query).toHaveBeenCalledTimes(1);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('ON CONFLICT');
    const params = query.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe('2026-05-04');
    expect(params[4]).toBe(1);
  });
});
