import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { Webhooks } from '@octokit/webhooks';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export interface WebhookSignatureOptions {
  secret: string;
}

export const webhookSignaturePlugin: FastifyPluginAsync<WebhookSignatureOptions> = async (
  fastify,
  opts,
) => {
  const webhooks = new Webhooks({ secret: opts.secret });

  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  fastify.addHook('preHandler', async (request: FastifyRequest, reply) => {
    if (!request.routeOptions.url?.startsWith('/webhooks')) return;

    const signature = request.headers['x-hub-signature-256'];
    if (typeof signature !== 'string') {
      await reply.status(400).send({ error: 'Missing X-Hub-Signature-256 header' });
      return;
    }

    const body = request.body as Buffer;
    request.rawBody = body;

    const valid = await webhooks.verify(body.toString(), signature);
    if (!valid) {
      await reply.status(401).send({ error: 'Invalid webhook signature' });
    }
  });
};
