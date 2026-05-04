import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifyGitHubWebhookSignature } from './signature.js';

describe('verifyGitHubWebhookSignature', () => {
  it('accepts valid signatures', () => {
    const secret = 's3cret';
    const payload = '{"hello":"world"}';
    const digest = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    expect(verifyGitHubWebhookSignature(secret, payload, `sha256=${digest}`)).toBe(true);
  });

  it('rejects invalid signatures', () => {
    expect(verifyGitHubWebhookSignature('a', '{}', 'sha256=deadbeef')).toBe(false);
  });
});
