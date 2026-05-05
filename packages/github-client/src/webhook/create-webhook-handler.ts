import { Webhooks } from '@octokit/webhooks';

export function createWebhookHandler(secret: string): Webhooks {
  return new Webhooks({ secret });
}
