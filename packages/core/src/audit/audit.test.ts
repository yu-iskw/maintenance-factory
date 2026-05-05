import { describe, expect, it } from 'vitest';

import { assertNoTranscriptField, redactSummary } from './audit.js';

describe('redactSummary', () => {
  it('redacts bearer tokens', () => {
    expect(redactSummary('log: Bearer secret123')).toContain('[REDACTED]');
  });

  it('redacts ghp tokens', () => {
    expect(redactSummary('token ghp_abcdefghijklmnop')).toContain('[REDACTED]');
  });
});

describe('assertNoTranscriptField', () => {
  it('allows short strings', () => {
    expect(() => assertNoTranscriptField('summary', 'ok')).not.toThrow();
  });

  it('rejects transcript-like long content', () => {
    const fake = `user: ${'x'.repeat(1500)}\nassistant: ${'y'.repeat(1500)}`;
    expect(() => assertNoTranscriptField('summary', fake)).toThrow(/transcript/);
  });
});
