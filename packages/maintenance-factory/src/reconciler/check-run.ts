export type CheckRunWebhookPayload = {
  action?: string;
  repository?: { full_name?: string };
  check_run?: {
    id?: number;
    name?: string;
    status?: string;
    conclusion?: string | null;
    html_url?: string;
    pull_requests?: Array<{ number?: number; url?: string }>;
  };
};

export type ReconcileCheckRunResult = {
  repoFullName: string;
  checkRunId: number;
  name: string;
  status: string;
  conclusion: string | null;
  prNumber?: number;
  prUrl?: string;
};

export function reconcileCheckRunEvent(body: CheckRunWebhookPayload): ReconcileCheckRunResult | undefined {
  const repoFullName = body.repository?.full_name;
  const run = body.check_run;
  if (!repoFullName || !run?.id || !run.name || !run.status) {
    return undefined;
  }
  const pr = run.pull_requests?.[0];
  return {
    repoFullName,
    checkRunId: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion ?? null,
    prNumber: pr?.number,
    prUrl: pr?.url,
  };
}
