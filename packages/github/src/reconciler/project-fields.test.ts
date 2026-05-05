import { describe, expect, it } from 'vitest';

import {
  projectFieldNames,
  reconcileFromCheckRun,
  reconcileFromCheckSuite,
  reconcileFromPullRequest,
  reconcileFromPullRequestReview,
} from './project-fields.js';

describe('reconcileFromPullRequest', () => {
  it('maps merged PR to Merged status', () => {
    const updates = reconcileFromPullRequest({
      action: 'closed',
      pull_request: {
        html_url: 'https://github.com/o/r/pull/1',
        state: 'closed',
        merged: true,
      },
    });
    expect(updates.find((u) => u.fieldName === projectFieldNames.status)?.value).toBe('Merged');
  });

  it('infers merged from merged_at when merged flag omitted', () => {
    const updates = reconcileFromPullRequest({
      pull_request: {
        html_url: 'https://github.com/o/r/pull/3',
        state: 'closed',
        merged_at: '2026-01-01T00:00:00Z',
      },
    });
    expect(updates.find((u) => u.fieldName === projectFieldNames.status)?.value).toBe('Merged');
  });
});

describe('reconcileFromCheckRun', () => {
  it('marks blocked on failed check_run conclusion', () => {
    const updates = reconcileFromCheckRun({
      check_run: { conclusion: 'failure', status: 'completed' },
    });
    expect(updates.find((u) => u.fieldName === projectFieldNames.status)?.value).toBe('Blocked');
  });
});

describe('reconcileFromCheckSuite', () => {
  it('marks blocked on failed suite conclusion', () => {
    const updates = reconcileFromCheckSuite({
      check_suite: { conclusion: 'failure', status: 'completed' },
    });
    expect(updates.find((u) => u.fieldName === projectFieldNames.status)?.value).toBe('Blocked');
  });
});

describe('reconcileFromPullRequestReview', () => {
  it('records approval summary', () => {
    const updates = reconcileFromPullRequestReview({
      pull_request: { html_url: 'https://github.com/o/r/pull/9' },
      review: { state: 'approved' },
    });
    expect(updates.find((u) => u.fieldName === projectFieldNames.lastValidation)?.value).toContain(
      'approved',
    );
  });
});
