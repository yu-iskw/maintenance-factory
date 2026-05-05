import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import { adminRoutes } from './routes/admin';
import { healthRoutes } from './routes/health';
import { webhookRoutes } from './routes/webhooks';

import type { ReconcilerDeps } from '@maintenance-factory/reconciler';
import type { SchedulerHandle } from '@maintenance-factory/scheduler';
import type { AppConfig } from '@maintenance-factory/types';

interface AppOptions {
  config: AppConfig;
  reconcilerDeps: ReconcilerDeps;
  schedulerHandle: SchedulerHandle;
}

export function buildApp(opts: AppOptions) {
  const app = Fastify({ logger: { level: opts.config.logLevel } });

  void app.register(cors);
  void app.register(rateLimit, { max: 120, timeWindow: '1 minute', global: true });

  void app.register(healthRoutes);

  void app.register(webhookRoutes, {
    reconcilerDeps: opts.reconcilerDeps,
    webhookSecret: opts.config.githubWebhookSecret,
  });

  const schedulerEnabled = { value: opts.config.schedulerEnabled };
  void app.register(adminRoutes, {
    schedulerHandle: opts.schedulerHandle,
    schedulerEnabled,
  });

  return app;
}
