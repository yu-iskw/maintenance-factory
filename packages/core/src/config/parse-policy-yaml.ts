import { parse as parseYaml } from 'yaml';

import { maintenanceTaskTypes, repoCriticalityLevels, riskLevels } from '../domain/types.js';

import { defaultPolicyDocument } from './policy-types.js';

import type { PolicyDocument } from './policy-types.js';
import type { MaintenanceTaskType, RiskLevel } from '../domain/types.js';

/* eslint-disable security/detect-object-injection -- YAML keys are validated against static unions */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(`${path} must be a number`);
  }
  return value;
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${path} must be a boolean`);
  }
  return value;
}

function parseTaskTypes(arr: unknown, path: string): MaintenanceTaskType[] {
  if (!Array.isArray(arr)) {
    throw new TypeError(`${path} must be an array`);
  }
  const out: MaintenanceTaskType[] = [];
  for (const item of arr) {
    if (typeof item !== 'string' || !maintenanceTaskTypes.includes(item as MaintenanceTaskType)) {
      throw new TypeError(`${path} contains invalid task type: ${String(item)}`);
    }
    out.push(item as MaintenanceTaskType);
  }
  return out;
}

function parseRiskLevels(arr: unknown, path: string): RiskLevel[] | undefined {
  if (arr === undefined) {
    return undefined;
  }
  if (!Array.isArray(arr)) {
    throw new TypeError(`${path} must be an array`);
  }
  const out: RiskLevel[] = [];
  for (const item of arr) {
    if (typeof item !== 'string' || !riskLevels.includes(item as RiskLevel)) {
      throw new TypeError(`${path} contains invalid risk: ${String(item)}`);
    }
    out.push(item as RiskLevel);
  }
  return out;
}

function parseRepoCriticalitySection(
  raw: unknown,
  path: string,
): PolicyDocument['repo_criticality'] {
  if (!isRecord(raw)) {
    throw new TypeError(`${path} must be an object`);
  }
  const out: PolicyDocument['repo_criticality'] = { ...defaultPolicyDocument.repo_criticality };
  for (const level of repoCriticalityLevels) {
    const section = raw[level];
    if (section === undefined) {
      continue;
    }
    if (!isRecord(section)) {
      throw new TypeError(`${path}.${level} must be an object`);
    }
    out[level] = {
      scheduled_runs: assertBoolean(section.scheduled_runs, `${path}.${level}.scheduled_runs`),
      required_reviews: Array.isArray(section.required_reviews)
        ? section.required_reviews.map((r) => String(r))
        : [],
      max_concurrent_runs:
        section.max_concurrent_runs === undefined
          ? undefined
          : assertNumber(section.max_concurrent_runs, `${path}.${level}.max_concurrent_runs`),
    };
  }
  return out;
}

function parseTaskPolicies(raw: unknown, path: string): PolicyDocument['task_policies'] {
  if (raw === undefined) {
    return {};
  }
  if (!isRecord(raw)) {
    throw new TypeError(`${path} must be an object`);
  }
  const out: PolicyDocument['task_policies'] = {};
  for (const key of maintenanceTaskTypes) {
    const rule = raw[key];
    if (rule === undefined) {
      continue;
    }
    if (!isRecord(rule)) {
      throw new TypeError(`${path}.${key} must be an object`);
    }
    out[key] = {
      allowed_risk: parseRiskLevels(rule.allowed_risk, `${path}.${key}.allowed_risk`),
      max_retries:
        rule.max_retries === undefined
          ? undefined
          : assertNumber(rule.max_retries, `${path}.${key}.max_retries`),
      require_advisory_reference:
        rule.require_advisory_reference === undefined
          ? undefined
          : assertBoolean(
              rule.require_advisory_reference,
              `${path}.${key}.require_advisory_reference`,
            ),
      allowed_scopes: Array.isArray(rule.allowed_scopes)
        ? rule.allowed_scopes.map((s) => String(s))
        : undefined,
    };
  }
  return out;
}

/**
 * Parse and validate policy-as-code YAML into a PolicyDocument.
 */
export function parsePolicyYaml(yamlText: string): PolicyDocument {
  const parsed: unknown = parseYaml(yamlText);
  if (!isRecord(parsed)) {
    throw new TypeError('Policy root must be a mapping');
  }
  const version = assertNumber(parsed.version, 'version');
  if (version !== 1) {
    throw new RangeError(`Unsupported policy version: ${version}`);
  }
  const globalRaw = parsed.global;
  if (!isRecord(globalRaw)) {
    throw new TypeError('global must be an object');
  }
  const global = {
    never_auto_merge: assertBoolean(globalRaw.never_auto_merge, 'global.never_auto_merge'),
    max_global_concurrent_runs: assertNumber(
      globalRaw.max_global_concurrent_runs,
      'global.max_global_concurrent_runs',
    ),
    max_runs_per_repo: assertNumber(globalRaw.max_runs_per_repo, 'global.max_runs_per_repo'),
    max_runs_per_owner_team: assertNumber(
      globalRaw.max_runs_per_owner_team,
      'global.max_runs_per_owner_team',
    ),
    max_daily_runs: assertNumber(globalRaw.max_daily_runs, 'global.max_daily_runs'),
    retry_limit_per_task: assertNumber(
      globalRaw.retry_limit_per_task,
      'global.retry_limit_per_task',
    ),
  };
  if (!global.never_auto_merge) {
    throw new RangeError('never_auto_merge must be true for this factory');
  }
  const allowed_task_types = parseTaskTypes(parsed.allowed_task_types, 'allowed_task_types');
  const forbidden_paths = Array.isArray(parsed.forbidden_paths)
    ? parsed.forbidden_paths.map((p) => String(p))
    : [];
  const repo_criticality = parseRepoCriticalitySection(parsed.repo_criticality, 'repo_criticality');
  const task_policies = parseTaskPolicies(parsed.task_policies, 'task_policies');

  return {
    version,
    global,
    allowed_task_types,
    forbidden_paths,
    repo_criticality,
    task_policies,
  };
}
