import { describe, expect, it } from 'vitest';

import { evaluateKillSwitches, type KillSwitchRow } from './kill-switches.js';

describe('evaluateKillSwitches', () => {
  it('detects global pause', () => {
    const rows: KillSwitchRow[] = [{ scope: 'global', scopeKey: '', paused: true }];
    const flags = evaluateKillSwitches({
      repoFullName: 'org/r',
      taskType: 'dependabot_shepherd',
      ecosystem: 'npm',
      repoCriticality: 'standard',
      rows,
    });
    expect(flags.killSwitchGlobalPause).toBe(true);
    expect(flags.killSwitchRepo).toBe(false);
  });

  it('detects repo pause with case-insensitive key match', () => {
    const rows: KillSwitchRow[] = [{ scope: 'repo', scopeKey: 'org/r', paused: true }];
    const flags = evaluateKillSwitches({
      repoFullName: 'Org/R',
      taskType: 'dependabot_shepherd',
      ecosystem: 'npm',
      repoCriticality: 'standard',
      rows,
    });
    expect(flags.killSwitchRepo).toBe(true);
  });

  it('detects ecosystem pause with case-insensitive key', () => {
    const rows: KillSwitchRow[] = [{ scope: 'ecosystem', scopeKey: 'npm', paused: true }];
    const flags = evaluateKillSwitches({
      repoFullName: 'org/r',
      taskType: 'dependabot_shepherd',
      ecosystem: 'NPM',
      repoCriticality: 'standard',
      rows,
    });
    expect(flags.killSwitchEcosystem).toBe(true);
  });
});
