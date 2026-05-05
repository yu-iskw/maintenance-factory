import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { handleGithubWebhookEvent } from './github-webhook-handler.js';

import type { ProjectFieldUpdate } from '@maintenance-factory/github';

export interface MaintenanceGithubWebhookServerOptions {
  webhookSecret: string;
  /** HTTP path, default `/webhooks/github` */
  path?: string;
  /**
   * Apply reconciler output — e.g. map `ProjectFieldUpdate[]` to
   * `updateProjectV2ItemFieldValue` calls using your Project/field option ids.
   */
  onProjectFieldUpdates?: (args: {
    eventName: string;
    deliveryId?: string;
    updates: ProjectFieldUpdate[];
  }) => Promise<void>;
}

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

function headerString(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  if (typeof v === 'string') {
    return v;
  }
  if (Array.isArray(v) && v.length > 0) {
    return v[0];
  }
  return undefined;
}

/**
 * Minimal `node:http` server for GitHub App webhooks (RFC §9.3).
 */
export function createMaintenanceGithubWebhookServer(
  opts: MaintenanceGithubWebhookServerOptions,
): ReturnType<typeof createServer> {
  const path = opts.path ?? '/webhooks/github';
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    void handleMaintenanceGithubWebhookRequest(req, res, path, opts);
  });
}

async function handleMaintenanceGithubWebhookRequest(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  opts: MaintenanceGithubWebhookServerOptions,
): Promise<void> {
  if (req.method !== 'POST' || req.url !== path) {
    res.writeHead(404).end();
    return;
  }
  const raw = await readRawBody(req);
  const rawStr = raw.toString('utf8');
  const sig = headerString(req, 'x-hub-signature-256');
  const eventName = headerString(req, 'x-github-event') ?? '';
  const deliveryId = headerString(req, 'x-github-delivery');
  const result = handleGithubWebhookEvent({
    webhookSecret: opts.webhookSecret,
    rawBody: rawStr,
    signatureHeader: sig,
    eventName,
    deliveryId,
  });
  if (!result.ok) {
    res.writeHead(result.status, { 'content-type': 'text/plain; charset=utf-8' }).end(result.body);
    return;
  }
  if (opts.onProjectFieldUpdates) {
    await opts.onProjectFieldUpdates({
      eventName: result.eventName,
      deliveryId: result.deliveryId,
      updates: result.updates,
    });
  }
  res.writeHead(202, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, updateCount: result.updates.length }));
}
