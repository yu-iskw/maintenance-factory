import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyGitHubWebhookSignature(secret: string, payload: string, signatureHeader: string | undefined) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  const received = signatureHeader.slice('sha256='.length);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(received, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
