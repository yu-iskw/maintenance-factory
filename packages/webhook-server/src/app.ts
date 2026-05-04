import fastify from 'fastify';
import cors from '@fastify/cors';

import type { ReconcilerDeps } from '@maintenance-factory/reconciler';
import type { SchedulerHandle } from '@maintenance-factory/scheduler';
import type { AppConfig } from '@maintenance-factory/types';

import { webhookSignaturePlugin } from './middleware/webhook-signature';
import { adminRoutes } from './routes/admin';
import { healthRoutes } from './routes/health';
import { webhookRoutes } from './routes/webhooks';

export interface AppOptions {
  config: AppConfig;
  reconcilerDeps: ReconcilerDeps;
  schedulerHandle: SchedulerHandle;
}

export function buildApp(opts: AppOptions) {
  const app = fastify({ logger: { level: opts.config.logLevel } });

  void app.register(cors);

  void app.register(webhookSignaturePlugin, { secret: opts.config.githubWebhookSecret });

  void app.register(healthRoutes);

  void app.register(webhookRoutes, { reconcilerDeps: opts.reconcilerDeps });

  const schedulerEnabled = { value: opts.config.schedulerEnabled };
  void app.register(adminRoutes, {
    schedulerHandle: opts.schedulerHandle,
    schedulerEnabled,
  });

  return app;
}
