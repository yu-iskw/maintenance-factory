import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import type { ReconcilerDeps } from '@maintenance-factory/reconciler';
import { reconcileItem } from '@maintenance-factory/reconciler';
import type { ProjectItem } from '@maintenance-factory/types';

export interface WebhookRoutesOptions {
  reconcilerDeps: ReconcilerDeps;
}

export const webhookRoutes: FastifyPluginAsync<WebhookRoutesOptions> = async (fastify, opts) => {
  fastify.post(
    '/webhooks/github',
    async (request: FastifyRequest<{ Body: Buffer }>, reply) => {
      const event = request.headers['x-github-event'];
      const body = JSON.parse((request.rawBody ?? request.body).toString()) as Record<string, unknown>;

      fastify.log.debug({ event }, 'Received GitHub webhook event');

      if (event === 'pull_request') {
        const action = body['action'];
        if (action === 'closed' || action === 'synchronize') {
          const pr = body['pull_request'] as { html_url?: string } | undefined;
          if (pr?.html_url) {
            const fakeItem: Partial<ProjectItem> = {
              prUrl: pr.html_url,
              status: 'PR Open',
              repoFullName: (body['repository'] as { full_name?: string })?.full_name ?? '',
            };
            await reconcileItem(opts.reconcilerDeps, fakeItem as ProjectItem).catch((err) => {
              fastify.log.error({ err }, 'Reconciler error on pull_request event');
            });
          }
        }
      }

      return reply.status(200).send({ ok: true });
    },
  );
};
