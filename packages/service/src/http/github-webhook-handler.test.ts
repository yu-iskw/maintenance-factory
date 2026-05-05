import { createHmac } from 'crypto';

import { describe, expect, it } from 'vitest';

import { handleGithubWebhookEvent } from './github-webhook-handler.js';

describe('handleGithubWebhookEvent', () => {
  it('returns 400 on malformed JSON with valid signature', () => {
    const secret = 's';
    const body = '{ not json';
    const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
    const r = handleGithubWebhookEvent({
      webhookSecret: secret,
      rawBody: body,
      signatureHeader: sig,
      eventName: 'pull_request',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
    }
  });
});
