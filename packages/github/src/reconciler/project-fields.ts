/** RFC §8.2 single-select and text field names for Projects v2 custom fields */
export const projectFieldNames = {
  status: 'Status',
  repository: 'Repository',
  maintenanceType: 'Maintenance Type',
  severity: 'Severity',
  risk: 'Risk',
  repoCriticality: 'Repo Criticality',
  ecosystem: 'Ecosystem',
  agentEligible: 'Agent Eligible',
  scheduledEligible: 'Scheduled Eligible',
  agentStatus: 'Agent Status',
  requiredReview: 'Required Review',
  pr: 'PR',
  cursorRunId: 'Cursor Run ID',
  lastRunSummary: 'Last Run Summary',
  lastValidation: 'Last Validation',
  lastUpdatedBy: 'Last Updated By',
  blockedReason: 'Blocked Reason',
} as const;

export type ProjectFieldName = (typeof projectFieldNames)[keyof typeof projectFieldNames];

export interface ProjectFieldUpdate {
  /** Human-readable field name as configured on the Project */
  fieldName: ProjectFieldName | string;
  /** Text or option name for MVP; GraphQL layer maps to option ids */
  value: string | boolean;
  lastUpdatedBy: 'Reconciler';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface PullRequestPayload {
  pull_request?: {
    html_url?: string;
    state?: string;
    merged?: boolean;
    /** When set on a closed PR, GitHub merged it even if `merged` is omitted in some payloads. */
    merged_at?: string | null;
  };
}

/**
 * Derive canonical Project field updates from a pull_request webhook payload.
 * Does not call GitHub; consumers apply updates via GraphQL.
 */
export function reconcileFromPullRequest(payload: unknown): ProjectFieldUpdate[] {
  if (!isRecord(payload)) {
    return [];
  }
  const pr = payload.pull_request;
  if (!isRecord(pr)) {
    return [];
  }
  const htmlUrl = typeof pr.html_url === 'string' ? pr.html_url : undefined;
  const state = typeof pr.state === 'string' ? pr.state : undefined;
  const mergedAt =
    pr.merged_at !== null && pr.merged_at !== undefined && typeof pr.merged_at === 'string'
      ? pr.merged_at.trim()
      : '';
  const mergedByFlag = pr.merged === true;
  const mergedByTimestamp = state === 'closed' && mergedAt.length > 0;
  const merged = mergedByFlag || mergedByTimestamp;

  const updates: ProjectFieldUpdate[] = [];
  if (htmlUrl) {
    updates.push({
      fieldName: projectFieldNames.pr,
      value: htmlUrl,
      lastUpdatedBy: 'Reconciler',
    });
  }

  if (merged) {
    updates.push({
      fieldName: projectFieldNames.status,
      value: 'Merged',
      lastUpdatedBy: 'Reconciler',
    });
    updates.push({
      fieldName: projectFieldNames.agentStatus,
      value: 'Succeeded',
      lastUpdatedBy: 'Reconciler',
    });
  } else if (state === 'open') {
    updates.push({
      fieldName: projectFieldNames.status,
      value: 'PROpen',
      lastUpdatedBy: 'Reconciler',
    });
  } else if (state === 'closed' && !merged) {
    updates.push({
      fieldName: projectFieldNames.status,
      value: 'Blocked',
      lastUpdatedBy: 'Reconciler',
    });
    updates.push({
      fieldName: projectFieldNames.blockedReason,
      value: 'Pull request closed without merge',
      lastUpdatedBy: 'Reconciler',
    });
  }

  updates.push({
    fieldName: projectFieldNames.lastUpdatedBy,
    value: 'Reconciler',
    lastUpdatedBy: 'Reconciler',
  });

  return updates;
}

function updatesForCiConclusion(args: {
  conclusion: string | null;
  status: string;
  summaryLead: 'check' | 'check_suite';
  blockedReasonLead: 'CI check failed' | 'CI suite failed';
}): ProjectFieldUpdate[] {
  const { conclusion, status, summaryLead, blockedReasonLead } = args;
  const summary =
    conclusion !== null && conclusion !== ''
      ? `${summaryLead}: ${status} conclusion=${conclusion}`
      : `${summaryLead}: ${status}`;
  const updates: ProjectFieldUpdate[] = [
    {
      fieldName: projectFieldNames.lastValidation,
      value: summary,
      lastUpdatedBy: 'Reconciler',
    },
    {
      fieldName: projectFieldNames.lastUpdatedBy,
      value: 'Reconciler',
      lastUpdatedBy: 'Reconciler',
    },
  ];
  if (conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'cancelled') {
    updates.unshift({
      fieldName: projectFieldNames.status,
      value: 'Blocked',
      lastUpdatedBy: 'Reconciler',
    });
    updates.splice(1, 0, {
      fieldName: projectFieldNames.blockedReason,
      value: `${blockedReasonLead}: ${conclusion}`,
      lastUpdatedBy: 'Reconciler',
    });
  }
  return updates;
}

export interface CheckRunPayload {
  check_run?: {
    conclusion?: string | null;
    status?: string;
    html_url?: string;
  };
}

export function reconcileFromCheckRun(payload: unknown): ProjectFieldUpdate[] {
  if (!isRecord(payload)) {
    return [];
  }
  const cr = payload.check_run;
  if (!isRecord(cr)) {
    return [];
  }
  const conclusion = typeof cr.conclusion === 'string' ? cr.conclusion : null;
  const status = typeof cr.status === 'string' ? cr.status : '';
  return updatesForCiConclusion({
    conclusion,
    status,
    summaryLead: 'check',
    blockedReasonLead: 'CI check failed',
  });
}

export interface CheckSuitePayload {
  check_suite?: {
    conclusion?: string | null;
    status?: string;
  };
}

/** Aggregate CI outcome when GitHub delivers `check_suite` instead of `check_run` (RFC §9.3). */
export function reconcileFromCheckSuite(payload: unknown): ProjectFieldUpdate[] {
  if (!isRecord(payload)) {
    return [];
  }
  const suite = payload.check_suite;
  if (!isRecord(suite)) {
    return [];
  }
  const conclusion = typeof suite.conclusion === 'string' ? suite.conclusion : null;
  const status = typeof suite.status === 'string' ? suite.status : '';
  return updatesForCiConclusion({
    conclusion,
    status,
    summaryLead: 'check_suite',
    blockedReasonLead: 'CI suite failed',
  });
}

export interface PullRequestReviewPayload {
  pull_request?: {
    html_url?: string;
  };
  review?: {
    state?: string;
  };
}

/** Track review signals for board hygiene (RFC §9.3 `pull_request_review`). */
export function reconcileFromPullRequestReview(payload: unknown): ProjectFieldUpdate[] {
  if (!isRecord(payload)) {
    return [];
  }
  const pr = payload.pull_request;
  const review = payload.review;
  if (!isRecord(pr) || !isRecord(review)) {
    return [];
  }
  const htmlUrl = typeof pr.html_url === 'string' ? pr.html_url : undefined;
  const state = typeof review.state === 'string' ? review.state : '';
  const updates: ProjectFieldUpdate[] = [];
  if (htmlUrl) {
    updates.push({
      fieldName: projectFieldNames.pr,
      value: htmlUrl,
      lastUpdatedBy: 'Reconciler',
    });
  }
  let summary = 'PR review event';
  if (state === 'approved') {
    summary = 'PR review: approved';
  } else if (state === 'changes_requested') {
    summary = 'PR review: changes requested';
  } else if (state) {
    summary = `PR review: ${state}`;
  }
  updates.push(
    {
      fieldName: projectFieldNames.lastValidation,
      value: summary,
      lastUpdatedBy: 'Reconciler',
    },
    {
      fieldName: projectFieldNames.lastUpdatedBy,
      value: 'Reconciler',
      lastUpdatedBy: 'Reconciler',
    },
  );
  return updates;
}
