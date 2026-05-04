import { describe, expect, it } from 'vitest';

import type { CheckStatus, PullRequest } from '@maintenance-factory/types';

import { resolveProjectState } from './state-resolver';

const openPR: PullRequest = {
  number: 1,
  url: 'https://github.com/org/repo/pull/1',
  title: 'chore: update deps',
  state: 'open',
  headRef: 'agent/dependabot_shepherd/org-repo/task-1',
  baseRef: 'main',
  isDraft: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const successChecks: CheckStatus = {
  state: 'success',
  conclusion: 'success',
  totalCount: 3,
  failedCount: 0,
  pendingCount: 0,
};

const failedChecks: CheckStatus = {
  state: 'failure',
  conclusion: 'failure',
  totalCount: 3,
  failedCount: 1,
  pendingCount: 0,
};

const pendingChecks: CheckStatus = {
  state: 'pending',
  conclusion: null,
  totalCount: 3,
  failedCount: 0,
  pendingCount: 2,
};

describe('resolveProjectState', () => {
  it('returns Merged when PR is merged', () => {
    expect(resolveProjectState('PR Open', { ...openPR, state: 'merged' }, null)).toBe('Merged');
  });

  it('returns Blocked when PR is closed (not merged)', () => {
    expect(resolveProjectState('PR Open', { ...openPR, state: 'closed' }, null)).toBe('Blocked');
  });

  it('returns Needs Review when PR is open with passing checks', () => {
    expect(resolveProjectState('PR Open', openPR, successChecks)).toBe('Needs Review');
  });

  it('returns Blocked when PR is open with failing checks', () => {
    expect(resolveProjectState('Needs Review', openPR, failedChecks)).toBe('Blocked');
  });

  it('returns PR Open when PR is open with pending checks', () => {
    expect(resolveProjectState('Agent Running', openPR, pendingChecks)).toBe('PR Open');
  });

  it('returns Blocked when PR Open status but no PR found', () => {
    expect(resolveProjectState('PR Open', null, null)).toBe('Blocked');
  });

  it('preserves status when no PR and status is Ready', () => {
    expect(resolveProjectState('Ready', null, null)).toBe('Ready');
  });
});
