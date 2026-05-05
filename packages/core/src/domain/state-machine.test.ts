import { describe, expect, it } from 'vitest';

import { canTransitionProjectStatus } from './state-machine.js';

describe('canTransitionProjectStatus', () => {
  it('allows Inbox to Triaged', () => {
    expect(canTransitionProjectStatus('Inbox', 'Triaged')).toBe(true);
  });

  it('denies Inbox to Merged', () => {
    expect(canTransitionProjectStatus('Inbox', 'Merged')).toBe(false);
  });

  it('allows same state', () => {
    expect(canTransitionProjectStatus('Ready', 'Ready')).toBe(true);
  });
});
