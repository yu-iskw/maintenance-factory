import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify `X-Hub-Signature-256` for GitHub webhooks (HMAC SHA-256 of raw body).
 */
export function verifyGithubWebhookSignature(
  secret: string,
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const provided = signatureHeader.slice('sha256='.length).trim().toLowerCase();
  const hmac = createHmac('sha256', secret);
  hmac.update(rawBody);
  const expected = hmac.digest('hex');
  try {
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type GithubWebhookEventName =
  | 'pull_request'
  | 'pull_request_review'
  | 'check_suite'
  | 'check_run'
  | 'workflow_run'
  | 'installation'
  | 'installation_repositories'
  | string;

export interface NormalizedWebhook {
  eventName: GithubWebhookEventName;
  action?: string;
  deliveryId?: string;
  payload: unknown;
}

export function parseWebhookJson(rawBody: string): unknown {
  return JSON.parse(rawBody) as unknown;
}
