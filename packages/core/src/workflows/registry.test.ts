import { describe, expect, it } from 'vitest';

import { workflowFor } from './registry.js';

describe('workflowRegistry', () => {
  it('marks dependabot_shepherd pilot-eligible', () => {
    expect(workflowFor('dependabot_shepherd')?.scheduledInPilot).toBe(true);
  });
});
