import { listDependabotAlerts } from '../github/dependabot-alerts.js';
import { isLikelyDependabotPr, listOpenPullRequests } from '../github/scanner.js';

import {
  addDraftProjectItem,
  setProjectBooleanField,
  setProjectSingleSelect,
  setProjectTextField,
} from './v2-client.js';

import type { ProjectFieldCatalog } from './v2-client.js';
import type { MaintenanceStore } from '../db/store.js';
import type { graphql } from '@octokit/graphql';
import type { Octokit } from '@octokit/rest';

type GraphqlFn = ReturnType<typeof graphql.defaults>;

const F_STATUS = 'Status';
const F_MAINTENANCE_TYPE = 'Maintenance Type';
const F_SEVERITY = 'Severity';
const F_RISK = 'Risk';
const F_REPO_CRITICALITY = 'Repo Criticality';
const F_AGENT_ELIGIBLE = 'Agent Eligible';
const F_SCHEDULED_ELIGIBLE = 'Scheduled Eligible';
const F_AGENT_STATUS = 'Agent Status';
const F_LAST_UPDATED_BY = 'Last Updated By';

function parseRepo(fullName: string): { owner: string; repo: string } | undefined {
  const parts = fullName.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return undefined;
  }
  return { owner: parts[0], repo: parts[1] };
}

type SeverityTier = 'critical' | 'high' | 'medium' | 'low';

function severityTier(severity?: string): SeverityTier {
  const s = severity?.toLowerCase() ?? '';
  if (s === 'critical') {
    return 'critical';
  }
  if (s === 'high') {
    return 'high';
  }
  if (s === 'medium') {
    return 'medium';
  }
  return 'low';
}

function projectSelectLabelForTier(tier: SeverityTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function projectLabelForAdvisorySeverity(severity?: string): string {
  return projectSelectLabelForTier(severityTier(severity));
}

/* eslint-disable security/detect-object-injection -- Project field catalog is trusted operator config */
function fieldOptionId(catalog: ProjectFieldCatalog, fieldName: string, optionName: string): string {
  const field = catalog.fieldsByName[fieldName];
  const optionId = field.optionsByName?.[optionName];
  if (!field?.fieldId || !optionId) {
    throw new Error(`Missing Project field option: ${fieldName} / ${optionName}`);
  }
  return optionId;
}

function fieldId(catalog: ProjectFieldCatalog, fieldName: string): string {
  const field = catalog.fieldsByName[fieldName];
  if (!field?.fieldId) {
    throw new Error(`Missing Project field: ${fieldName}`);
  }
  return field.fieldId;
}
/* eslint-enable security/detect-object-injection */

const STALE_MS = 14 * 24 * 60 * 60 * 1000;

type ProjectWriteCtx = {
  gql: GraphqlFn;
  catalog: ProjectFieldCatalog;
  itemId: string;
};

async function setSelect(ctx: ProjectWriteCtx, field: string, option: string): Promise<void> {
  await setProjectSingleSelect({
    gql: ctx.gql,
    projectNodeId: ctx.catalog.projectNodeId,
    itemId: ctx.itemId,
    fieldId: fieldId(ctx.catalog, field),
    optionId: fieldOptionId(ctx.catalog, field, option),
  });
}

async function setBool(ctx: ProjectWriteCtx, field: string, value: boolean): Promise<void> {
  await setProjectBooleanField({
    gql: ctx.gql,
    projectNodeId: ctx.catalog.projectNodeId,
    itemId: ctx.itemId,
    fieldId: fieldId(ctx.catalog, field),
    value,
  });
}

async function setText(ctx: ProjectWriteCtx, field: string, text: string): Promise<void> {
  await setProjectTextField({
    gql: ctx.gql,
    projectNodeId: ctx.catalog.projectNodeId,
    itemId: ctx.itemId,
    fieldId: fieldId(ctx.catalog, field),
    text,
  });
}

async function ensureProjectItem(input: {
  gql: GraphqlFn;
  catalog: ProjectFieldCatalog;
  store: MaintenanceStore;
  dryRun: boolean;
  repoFullName: string;
  taskType: 'dependabot_shepherd' | 'direct_security_patch';
  externalId: string;
  title: string;
  body: string;
}): Promise<{ itemId: string; created: boolean }> {
  const existing = await input.store.findProjectItemId({
    projectNodeId: input.catalog.projectNodeId,
    repoFullName: input.repoFullName,
    taskType: input.taskType,
    externalId: input.externalId,
  });

  if (input.dryRun) {
    return { itemId: existing ?? 'dry-run', created: !existing };
  }

  if (existing) {
    return { itemId: existing, created: false };
  }

  const itemId = await addDraftProjectItem({
    gql: input.gql,
    projectNodeId: input.catalog.projectNodeId,
    title: input.title,
    body: input.body,
  });
  return { itemId, created: true };
}

type DependabotPrRow = Awaited<ReturnType<typeof listOpenPullRequests>>[number];

type SyncDependabotPrResult =
  | { kind: 'skip' }
  | { kind: 'dry'; wouldCreate: boolean }
  | { kind: 'created' }
  | { kind: 'updated' };

async function syncOneDependabotPr(input: {
  gql: GraphqlFn;
  catalog: ProjectFieldCatalog;
  store: MaintenanceStore;
  dryRun: boolean;
  repoFullName: string;
  pr: DependabotPrRow;
  now: number;
}): Promise<SyncDependabotPrResult> {
  if (!isLikelyDependabotPr(input.pr)) {
    return { kind: 'skip' };
  }
  const updatedAt = input.pr.updatedAt ? Date.parse(input.pr.updatedAt) : input.now;
  const stale = Number.isFinite(updatedAt) && input.now - updatedAt > STALE_MS;
  const idempotencyKey = `${input.repoFullName}:dependabot_shepherd:pr:${input.pr.number}`;
  const title = `[Dependabot] ${input.repoFullName}#${input.pr.number}: ${input.pr.title}`;
  const body = JSON.stringify({
    repo: input.repoFullName,
    pr: input.pr.number,
    stale,
    headRef: input.pr.headRef,
  });

  const ensured = await ensureProjectItem({
    gql: input.gql,
    catalog: input.catalog,
    store: input.store,
    dryRun: input.dryRun,
    repoFullName: input.repoFullName,
    taskType: 'dependabot_shepherd',
    externalId: String(input.pr.number),
    title,
    body,
  });
  if (input.dryRun) {
    return { kind: 'dry', wouldCreate: ensured.created };
  }

  const ctx: ProjectWriteCtx = { gql: input.gql, catalog: input.catalog, itemId: ensured.itemId };
  await setSelect(ctx, F_STATUS, stale ? 'Ready' : 'Inbox');
  await setSelect(ctx, F_MAINTENANCE_TYPE, 'Dependabot Shepherd');
  await setSelect(ctx, F_SEVERITY, 'Low');
  await setSelect(ctx, F_RISK, stale ? 'Medium' : 'Low');
  await setSelect(ctx, F_REPO_CRITICALITY, 'Standard');
  await setBool(ctx, F_AGENT_ELIGIBLE, stale);
  await setBool(ctx, F_SCHEDULED_ELIGIBLE, stale);
  await setSelect(ctx, F_AGENT_STATUS, 'Not Run');
  await setText(ctx, F_LAST_UPDATED_BY, 'Scanner');

  await input.store.upsertProjectItemIndex({
    idempotencyKey,
    projectNodeId: input.catalog.projectNodeId,
    projectItemId: ensured.itemId,
    repoFullName: input.repoFullName,
    taskType: 'dependabot_shepherd',
    externalId: String(input.pr.number),
    title,
  });

  return ensured.created ? { kind: 'created' } : { kind: 'updated' };
}

function bumpSyncCounts(
  counters: { created: number; updated: number },
  result: { kind: 'dry'; wouldCreate: boolean } | { kind: 'created' } | { kind: 'updated' },
): void {
  if (result.kind === 'dry') {
    if (result.wouldCreate) {
      counters.created += 1;
    } else {
      counters.updated += 1;
    }
    return;
  }
  if (result.kind === 'created') {
    counters.created += 1;
  } else {
    counters.updated += 1;
  }
}

export async function syncDependabotShepherdProjectItems(input: {
  gql: GraphqlFn;
  octokit: Octokit;
  catalog: ProjectFieldCatalog;
  store: MaintenanceStore;
  repoFullNames: readonly string[];
  dryRun: boolean;
}): Promise<{ created: number; updated: number }> {
  const counters = { created: 0, updated: 0 };
  const now = Date.now();

  for (const repoFullName of input.repoFullNames) {
    const parsed = parseRepo(repoFullName);
    if (!parsed) {
      continue;
    }
    const pulls = await listOpenPullRequests(input.octokit, parsed.owner, parsed.repo);
    for (const pr of pulls) {
      const result = await syncOneDependabotPr({
        gql: input.gql,
        catalog: input.catalog,
        store: input.store,
        dryRun: input.dryRun,
        repoFullName,
        pr,
        now,
      });
      if (result.kind === 'skip') {
        continue;
      }
      bumpSyncCounts(counters, result);
    }
  }

  return counters;
}

type DependabotAlertRow = Awaited<ReturnType<typeof listDependabotAlerts>>[number];

type SyncSecurityAlertResult =
  | { kind: 'dry'; wouldCreate: boolean }
  | { kind: 'created' }
  | { kind: 'updated' };

async function syncOneSecurityAlert(input: {
  gql: GraphqlFn;
  catalog: ProjectFieldCatalog;
  store: MaintenanceStore;
  dryRun: boolean;
  repoFullName: string;
  alert: DependabotAlertRow;
}): Promise<SyncSecurityAlertResult> {
  const idempotencyKey = `${input.repoFullName}:direct_security_patch:alert:${input.alert.number}`;
  const title = `[Security] ${input.repoFullName} alert #${input.alert.number}: ${input.alert.packageName ?? 'dependency'}`;
  const body = JSON.stringify({
    repo: input.repoFullName,
    alert: input.alert.number,
    severity: input.alert.severity,
    package: input.alert.packageName,
    ecosystem: input.alert.ecosystem,
  });

  const ensured = await ensureProjectItem({
    gql: input.gql,
    catalog: input.catalog,
    store: input.store,
    dryRun: input.dryRun,
    repoFullName: input.repoFullName,
    taskType: 'direct_security_patch',
    externalId: String(input.alert.number),
    title,
    body,
  });
  if (input.dryRun) {
    return { kind: 'dry', wouldCreate: ensured.created };
  }

  const ctx: ProjectWriteCtx = { gql: input.gql, catalog: input.catalog, itemId: ensured.itemId };
  await setSelect(ctx, F_STATUS, 'Ready');
  await setSelect(ctx, F_MAINTENANCE_TYPE, 'Security Patch');
  const advisoryLabel = projectLabelForAdvisorySeverity(input.alert.severity);
  await setSelect(ctx, F_SEVERITY, advisoryLabel);
  await setSelect(ctx, F_RISK, advisoryLabel);
  await setSelect(ctx, F_REPO_CRITICALITY, 'Standard');
  await setBool(ctx, F_AGENT_ELIGIBLE, true);
  await setBool(ctx, F_SCHEDULED_ELIGIBLE, true);
  await setSelect(ctx, F_AGENT_STATUS, 'Not Run');
  await setText(ctx, F_LAST_UPDATED_BY, 'Scanner');

  await input.store.upsertProjectItemIndex({
    idempotencyKey,
    projectNodeId: input.catalog.projectNodeId,
    projectItemId: ensured.itemId,
    repoFullName: input.repoFullName,
    taskType: 'direct_security_patch',
    externalId: String(input.alert.number),
    title,
  });

  return ensured.created ? { kind: 'created' } : { kind: 'updated' };
}

export async function syncDirectSecurityPatchItems(input: {
  gql: GraphqlFn;
  octokit: Octokit;
  catalog: ProjectFieldCatalog;
  store: MaintenanceStore;
  repoFullNames: readonly string[];
  dryRun: boolean;
}): Promise<{ created: number; updated: number }> {
  const counters = { created: 0, updated: 0 };

  for (const repoFullName of input.repoFullNames) {
    const parsed = parseRepo(repoFullName);
    if (!parsed) {
      continue;
    }
    const alerts = await listDependabotAlerts(input.octokit, parsed.owner, parsed.repo);
    for (const alert of alerts) {
      const result = await syncOneSecurityAlert({
        gql: input.gql,
        catalog: input.catalog,
        store: input.store,
        dryRun: input.dryRun,
        repoFullName,
        alert,
      });
      bumpSyncCounts(counters, result);
    }
  }

  return counters;
}
