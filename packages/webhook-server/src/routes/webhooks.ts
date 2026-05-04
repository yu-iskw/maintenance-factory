import { reconcileItem } from '@maintenance-factory/reconciler';
import { Webhooks } from '@octokit/webhooks';

import type { ReconcilerDeps, ReconcileTarget } from '@maintenance-factory/reconciler';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

export interface WebhookRoutesOptions {
  reconcilerDeps: ReconcilerDeps;
  webhookSecret: string;
}

export const webhookRoutes: FastifyPluginAsync<WebhookRoutesOptions> = async (fastify, opts) => {
  const webhooks = new Webhooks({ secret: opts.webhookSecret });

  // Scope the buffer parser to this plugin's routes only — admin/health routes
  // remain unaffected and use Fastify's default JSON parser.
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_, body, done) => {
    done(null, body);
  });

  fastify.post('/webhooks/github', async (request: FastifyRequest<{ Body: Buffer }>, reply) => {
    const signature = request.headers['x-hub-signature-256'];
    if (typeof signature !== 'string') {
      return reply.status(400).send({ error: 'Missing X-Hub-Signature-256 header' });
    }

    const body = request.body;
    const valid = await webhooks.verify(body.toString(), signature);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid webhook signature' });
    }

    const event = request.headers['x-github-event'];
    const payload = JSON.parse(body.toString()) as Record<string, unknown>;

    fastify.log.debug({ event }, 'Received GitHub webhook event');

    if (event === 'pull_request') {
      const action = payload['action'];
      if (action === 'closed' || action === 'synchronize') {
        const pr = payload['pull_request'] as { html_url?: string } | undefined;
        const repoFullName = (payload['repository'] as { full_name?: string })?.full_name ?? '';
        if (pr?.html_url && repoFullName) {
          const item: ReconcileTarget = {
            prUrl: pr.html_url,
            status: 'PR Open',
            repoFullName,
          };
          await reconcileItem(opts.reconcilerDeps, item).catch((err) => {
            fastify.log.error({ err }, 'Reconciler error on pull_request event');
          });
        }
      }
    }

    return reply.status(200).send({ ok: true });
  });
};
