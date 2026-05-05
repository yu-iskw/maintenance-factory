import {
  parseWebhookJson,
  reconcileWebhookEvent,
  verifyGithubWebhookSignature,
} from '@maintenance-factory/github';

import type { ProjectFieldUpdate } from '@maintenance-factory/github';

export interface GithubWebhookHandlerInput {
  webhookSecret: string;
  rawBody: string;
  signatureHeader: string | undefined;
  eventName: string;
  deliveryId?: string;
}

export type GithubWebhookHandlerResult =
  | { ok: true; eventName: string; deliveryId?: string; updates: ProjectFieldUpdate[] }
  | { ok: false; status: number; body: string };

/**
 * Verify signature, parse JSON, run reconciler (pure except crypto timing).
 * Wire `onProjectFieldUpdates` at the HTTP layer to call GitHub GraphQL (Projects v2).
 */
export function handleGithubWebhookEvent(
  input: GithubWebhookHandlerInput,
): GithubWebhookHandlerResult {
  if (!verifyGithubWebhookSignature(input.webhookSecret, input.rawBody, input.signatureHeader)) {
    return { ok: false, status: 401, body: 'invalid webhook signature' };
  }
  let payload: unknown;
  try {
    payload = parseWebhookJson(input.rawBody);
  } catch (e: unknown) {
    if (e instanceof SyntaxError) {
      return { ok: false, status: 400, body: 'invalid JSON payload' };
    }
    throw e;
  }
  const updates = reconcileWebhookEvent(input.eventName, payload);
  return {
    ok: true,
    eventName: input.eventName,
    deliveryId: input.deliveryId,
    updates,
  };
}
