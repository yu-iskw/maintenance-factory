import { createHmac } from 'crypto';

import { describe, expect, it } from 'vitest';

import { verifyGithubWebhookSignature } from './webhook.js';

describe('verifyGithubWebhookSignature', () => {
  it('accepts valid signature', () => {
    const secret = 'mysecret';
    const body = '{"hook":true}';
    const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyGithubWebhookSignature(secret, body, sig)).toBe(true);
  });

  it('rejects bad signature', () => {
    const secret = 'mysecret';
    const body = '{"hook":true}';
    expect(verifyGithubWebhookSignature(secret, body, 'sha256=deadbeef')).toBe(false);
  });

  it('accepts uppercase hex in signature header', () => {
    const secret = 'mysecret';
    const body = '{"hook":true}';
    const hex = createHmac('sha256', secret).update(body).digest('hex');
    const sig = `sha256=${hex.toUpperCase()}`;
    expect(verifyGithubWebhookSignature(secret, body, sig)).toBe(true);
  });
});
