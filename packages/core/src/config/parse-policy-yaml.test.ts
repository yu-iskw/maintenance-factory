import { describe, expect, it } from 'vitest';

import { parsePolicyYaml } from './parse-policy-yaml.js';

const minimalYaml = `
version: 1
global:
  never_auto_merge: true
  max_global_concurrent_runs: 5
  max_runs_per_repo: 1
  max_runs_per_owner_team: 2
  max_daily_runs: 30
  retry_limit_per_task: 1
allowed_task_types:
  - dependabot_shepherd
  - ci_diagnosis
forbidden_paths:
  - "**/auth/**"
repo_criticality:
  standard:
    scheduled_runs: true
    required_reviews:
      - codeowners
`;

describe('parsePolicyYaml', () => {
  it('parses minimal valid policy', () => {
    const doc = parsePolicyYaml(minimalYaml);
    expect(doc.global.never_auto_merge).toBe(true);
    expect(doc.allowed_task_types).toContain('dependabot_shepherd');
    expect(doc.forbidden_paths).toContain('**/auth/**');
  });

  it('rejects never_auto_merge false', () => {
    const bad = minimalYaml.replace('never_auto_merge: true', 'never_auto_merge: false');
    expect(() => parsePolicyYaml(bad)).toThrow(/never_auto_merge/);
  });
});
