import { describe, expect, it } from 'vitest';

import { isDependabotPull } from './dependabot.js';

describe('isDependabotPull', () => {
  it('detects dependabot bot', () => {
    expect(isDependabotPull('dependabot[bot]')).toBe(true);
  });

  it('rejects regular users', () => {
    expect(isDependabotPull('octocat')).toBe(false);
  });
});
