import type { PolicyDocument } from './policy-document.js';
import type { MaintenanceTaskInput, PolicyEvaluation, RepoCriticality, TaskType } from '../types/domain.js';

/* eslint-disable security/detect-object-injection -- YAML-backed policy maps use bounded keys */
function matchesGlobPattern(path: string, pattern: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  const regex = globToRegExp(pattern);
  return regex.test(normalized);
}

function globToRegExp(pattern: string): RegExp {
  let re = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i] ?? '';
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*';
        i += 2;
        if (pattern[i] === '/') {
          i += 1;
        }
        continue;
      }
      re += '[^/]*';
      i += 1;
      continue;
    }
    if (c === '?') {
      re += '[^/]';
      i += 1;
      continue;
    }
    if ('.+^${}()|[]\\'.includes(c)) {
      re += `\\${c}`;
      i += 1;
      continue;
    }
    re += c;
    i += 1;
  }
  // Glob patterns are trusted policy input (not arbitrary user strings).
  // eslint-disable-next-line security/detect-non-literal-regexp -- built from validated glob syntax
  return new RegExp(`^${re}$`);
}

function getCriticalityPolicy(
  policy: PolicyDocument,
  criticality: RepoCriticality,
): PolicyDocument['repo_criticality'][RepoCriticality] | undefined {
  if (criticality === 'standard' || criticality === 'sensitive' || criticality === 'critical') {
    return policy.repo_criticality[criticality];
  }
  return undefined;
}

function getTaskPolicy(policy: PolicyDocument, taskType: TaskType) {
  return policy.task_policies[taskType];
}

function evaluateRepoAndInstall(
  task: MaintenanceTaskInput,
  deny: (reason: string) => PolicyEvaluation,
  defer: (reason: string) => PolicyEvaluation,
): PolicyEvaluation | undefined {
  if (!task.repoInstalled || task.repoArchived) {
    return deny('repository not eligible (missing installation or archived)');
  }
  if (!task.repoProfileExists) {
    return defer('repo profile missing');
  }
  return undefined;
}

function evaluateAllowlistAndEligibility(
  policy: PolicyDocument,
  task: MaintenanceTaskInput,
  deny: (reason: string) => PolicyEvaluation,
): PolicyEvaluation | undefined {
  if (!policy.allowed_task_types.includes(task.taskType)) {
    return deny(`task type not allowlisted: ${task.taskType}`);
  }

  const criticalityPolicy = getCriticalityPolicy(policy, task.repoCriticality);
  if (!criticalityPolicy?.scheduled_runs) {
    return deny(`scheduled runs disabled for criticality ${task.repoCriticality}`);
  }

  if (!task.agentEligible) {
    return deny('Agent Eligible is false');
  }

  if (!task.scheduledEligible) {
    return deny('Scheduled Eligible is false');
  }

  return undefined;
}

function evaluateWorkflowState(
  task: MaintenanceTaskInput,
  defer: (reason: string) => PolicyEvaluation,
): PolicyEvaluation | undefined {
  const runnable =
    task.workflowStatus === 'ready' ||
    (task.workflowStatus === 'blocked' && task.agentStatus === 'retry_needed');
  if (!runnable) {
    return defer(`workflow status not runnable: ${task.workflowStatus} (agent ${task.agentStatus})`);
  }

  if (task.agentStatus === 'running') {
    return defer('agent already running for this task');
  }

  return undefined;
}

function evaluateConcurrencyGuards(
  task: MaintenanceTaskInput,
  deny: (reason: string) => PolicyEvaluation,
): PolicyEvaluation | undefined {
  if (task.hasActiveRunForRepoTask) {
    return deny('active run exists for same repo/task');
  }

  if (task.hasConflictingOpenPr) {
    return deny('conflicting open PR exists');
  }

  if (task.forbiddenPathMatch) {
    return deny(`forbidden path matched: ${task.forbiddenPathMatch}`);
  }

  return undefined;
}

function evaluateTaskSpecificRules(
  policy: PolicyDocument,
  task: MaintenanceTaskInput,
  deny: (reason: string) => PolicyEvaluation,
): PolicyEvaluation | undefined {
  const taskPolicy = getTaskPolicy(policy, task.taskType);
  const allowedRisk = taskPolicy?.allowed_risk;
  if (allowedRisk && !allowedRisk.includes(task.risk)) {
    return deny(`risk ${task.risk} not allowed for ${task.taskType}`);
  }

  if (task.taskType === 'direct_security_patch' && taskPolicy?.require_advisory_reference) {
    if (!task.advisoryReference || task.advisoryReference.trim() === '') {
      return deny('advisory reference required for direct_security_patch');
    }
  }

  if (task.taskType === 'dependency_freshness_patch' && taskPolicy?.allowed_scopes) {
    const scope = task.dependencyScope?.toLowerCase() ?? '';
    const allowed = taskPolicy.allowed_scopes.map((s) => s.toLowerCase());
    if (!scope || !allowed.includes(scope)) {
      return deny(`dependency scope not allowed for freshness patch: ${task.dependencyScope ?? 'unset'}`);
    }
  }

  const maxRetries = taskPolicy?.max_retries ?? policy.global.retry_limit_per_task;
  if (task.retryCount > maxRetries) {
    return deny(`retry limit exceeded (${task.retryCount} > ${maxRetries})`);
  }

  return undefined;
}

function evaluateForbiddenPathPatterns(
  policy: PolicyDocument,
  task: MaintenanceTaskInput,
  deny: (reason: string) => PolicyEvaluation,
): PolicyEvaluation | undefined {
  for (const pattern of policy.forbidden_paths) {
    if (task.forbiddenPathMatch && matchesGlobPattern(task.forbiddenPathMatch, pattern)) {
      return deny(`forbidden path pattern matched: ${pattern}`);
    }
  }
  return undefined;
}

export function evaluatePolicy(
  policy: PolicyDocument,
  task: MaintenanceTaskInput,
  policyVersion: string,
): PolicyEvaluation {
  const deny = (reason: string): PolicyEvaluation => ({
    decision: 'deny',
    reason,
    policyVersion,
  });

  const defer = (reason: string): PolicyEvaluation => ({
    decision: 'defer',
    reason,
    policyVersion,
  });

  if (!policy.global.never_auto_merge) {
    return deny('policy.global.never_auto_merge must be true');
  }

  return (
    evaluateRepoAndInstall(task, deny, defer) ??
    evaluateAllowlistAndEligibility(policy, task, deny) ??
    evaluateWorkflowState(task, defer) ??
    evaluateConcurrencyGuards(task, deny) ??
    evaluateTaskSpecificRules(policy, task, deny) ??
    evaluateForbiddenPathPatterns(policy, task, deny) ?? { decision: 'allow', policyVersion }
  );
}

export function findForbiddenPathMatch(
  changedPaths: readonly string[],
  forbiddenPatterns: readonly string[],
): string | undefined {
  for (const path of changedPaths) {
    for (const pattern of forbiddenPatterns) {
      if (matchesGlobPattern(path, pattern)) {
        return path;
      }
    }
  }
  return undefined;
}

/* eslint-enable security/detect-object-injection */
