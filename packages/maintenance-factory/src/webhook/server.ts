import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { verifyGitHubWebhookSignature } from './signature.js';

export type WebhookHandler = (event: string, body: unknown) => Promise<void>;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  input: { secret: string; onEvent: WebhookHandler },
): Promise<void> {
  if (req.method !== 'POST' || req.url !== '/webhooks') {
    res.statusCode = 404;
    res.end();
    return;
  }
  const raw = await readBody(req);
  const signature = req.headers['x-hub-signature-256'];
  const signatureString = Array.isArray(signature) ? signature[0] : signature;
  if (!verifyGitHubWebhookSignature(input.secret, raw, signatureString)) {
    res.statusCode = 401;
    res.end('invalid signature');
    return;
  }
  const event = req.headers['x-github-event'];
  const eventName = Array.isArray(event) ? event[0] : event;
  if (!eventName) {
    res.statusCode = 400;
    res.end('missing event');
    return;
  }
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    res.statusCode = 400;
    res.end('invalid json');
    return;
  }
  try {
    await input.onEvent(eventName, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.statusCode = 500;
    res.end(message);
    return;
  }
  res.statusCode = 202;
  res.end('accepted');
}

export async function startWebhookServer(input: {
  port: number;
  secret: string;
  onEvent: WebhookHandler;
}): Promise<{ close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    void handleRequest(req, res, input);
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(input.port, () => {
      resolve();
    });
    server.on('error', reject);
  });

  return {
    close: async () =>
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }),
  };
}
