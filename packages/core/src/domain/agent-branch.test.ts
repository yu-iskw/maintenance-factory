import { describe, expect, it } from 'vitest';

import { maintenanceAgentBranchName } from './agent-branch.js';

describe('maintenanceAgentBranchName', () => {
  it('builds a stable path-shaped branch name', () => {
    expect(maintenanceAgentBranchName('dependabot_shepherd', 'Org/Repo-Name', 'pr-42')).toBe(
      'agent/dependabot-shepherd/org-repo-name/pr-42',
    );
  });
});
