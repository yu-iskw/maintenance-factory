import { describe, expectTypeOf, it } from 'vitest';

import type {
  AgentRun,
  PolicyConfig,
  PolicyDecision,
  ProjectItem,
  RepoProfile,
  TaskStatus,
  TaskType,
  WorkerTask,
} from './index';

describe('shared domain types', () => {
  it('TaskType covers all RFC-defined task types', () => {
    const types: TaskType[] = [
      'dependabot_shepherd',
      'direct_security_patch',
      'dependency_freshness_patch',
      'repo_hygiene_scan',
      'repo_hygiene_config_pr',
      'ci_diagnosis',
    ];
    expectTypeOf(types).toMatchTypeOf<TaskType[]>();
  });

  it('TaskStatus covers the full workflow state machine', () => {
    const statuses: TaskStatus[] = [
      'Inbox',
      'Triaged',
      'Ready',
      'Queued',
      'Agent Running',
      'PR Open',
      'Needs Review',
      'Blocked',
      'Merged',
      'Snoozed',
    ];
    expectTypeOf(statuses).toMatchTypeOf<TaskStatus[]>();
  });

  it('ProjectItem has required fields', () => {
    expectTypeOf<ProjectItem>().toHaveProperty('id');
    expectTypeOf<ProjectItem>().toHaveProperty('repoFullName');
    expectTypeOf<ProjectItem>().toHaveProperty('status');
    expectTypeOf<ProjectItem>().toHaveProperty('compositeKey');
  });

  it('PolicyDecision is a discriminated union', () => {
    const allow: PolicyDecision = { allowed: true, reason: 'ok' };
    const deny: PolicyDecision = { allowed: false, reason: 'blocked', blockedBy: 'policy' };
    expectTypeOf(allow).toMatchTypeOf<PolicyDecision>();
    expectTypeOf(deny).toMatchTypeOf<PolicyDecision>();
  });

  it('AgentRun has backend and status', () => {
    expectTypeOf<AgentRun>().toHaveProperty('backend');
    expectTypeOf<AgentRun>().toHaveProperty('status');
  });

  it('WorkerTask has required fields', () => {
    expectTypeOf<WorkerTask>().toHaveProperty('projectItemId');
    expectTypeOf<WorkerTask>().toHaveProperty('taskType');
    expectTypeOf<WorkerTask>().toHaveProperty('compositeKey');
  });

  it('PolicyConfig has global limits', () => {
    expectTypeOf<PolicyConfig>().toHaveProperty('global');
    expectTypeOf<PolicyConfig>().toHaveProperty('allowedTaskTypes');
  });

  it('RepoProfile has criticality and owner team', () => {
    expectTypeOf<RepoProfile>().toHaveProperty('repoCriticality');
    expectTypeOf<RepoProfile>().toHaveProperty('repoFullName');
  });
});
