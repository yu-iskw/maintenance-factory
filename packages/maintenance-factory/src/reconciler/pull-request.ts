export type PullRequestWebhookPayload = {
  action?: string;
  repository?: { full_name?: string };
  pull_request?: {
    number?: number;
    html_url?: string;
    merged?: boolean;
    state?: string;
    head?: { ref?: string };
  };
};

export type ReconcilePullRequestResult = {
  repoFullName: string;
  prNumber: number;
  prUrl: string;
  merged: boolean;
  state: string;
};

export function reconcilePullRequestEvent(body: PullRequestWebhookPayload): ReconcilePullRequestResult | undefined {
  const repoFullName = body.repository?.full_name;
  const pr = body.pull_request;
  if (!repoFullName || !pr?.number || !pr.html_url) {
    return undefined;
  }
  return {
    repoFullName,
    prNumber: pr.number,
    prUrl: pr.html_url,
    merged: Boolean(pr.merged),
    state: String(pr.state ?? 'unknown'),
  };
}
