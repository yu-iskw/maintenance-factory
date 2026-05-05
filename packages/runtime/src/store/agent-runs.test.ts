import { describe, expect, it, vi } from 'vitest';

import { insertAgentRun } from './agent-runs.js';

import type { PoolClient } from 'pg';

describe('insertAgentRun', () => {
  it('redacts token-like policy_reason before insert', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const client = { query } as unknown as PoolClient;
    await insertAgentRun(client, {
      runUuid: '550e8400-e29b-41d4-a716-446655440000',
      githubProjectItemId: 'PVTI_1',
      repoFullName: 'o/r',
      taskType: 'dependabot_shepherd',
      risk: 'Low',
      repoCriticality: 'standard',
      policyDecision: 'allow',
      policyReason: 'ok ghp_deadbeefcafe',
      promptTemplateVersion: 'v1',
      status: 'Running',
      validationCommands: ['pnpm test'],
    });
    const params = query.mock.calls[0][1] as unknown[];
    expect(params[8]).toContain('[REDACTED]');
    expect(params[8]).not.toContain('ghp_');
  });
});
