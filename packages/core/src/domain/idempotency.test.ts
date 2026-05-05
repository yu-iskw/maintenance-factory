import { describe, expect, it } from 'vitest';

import { computeIdempotencyKey } from './idempotency.js';

describe('computeIdempotencyKey', () => {
  it('normalizes repo casing', () => {
    expect(computeIdempotencyKey('Org/My-Repo', 'dependabot_shepherd', '123')).toBe(
      'org/my-repo::dependabot_shepherd::123',
    );
  });

  it('is stable for same inputs', () => {
    const k = computeIdempotencyKey('org/repo', 'ci_diagnosis', 'abc');
    expect(computeIdempotencyKey('org/repo', 'ci_diagnosis', 'abc')).toBe(k);
  });
});
