import type { SchedulerHandle } from '@maintenance-factory/scheduler';
import type { FastifyPluginAsync } from 'fastify';

interface AdminRoutesOptions {
  schedulerHandle: SchedulerHandle;
  schedulerEnabled: { value: boolean };
}

export const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (fastify, opts) => {
  fastify.post('/admin/pause', async (_request, reply) => {
    opts.schedulerEnabled.value = false;
    opts.schedulerHandle.stop();
    return reply.send({ paused: true });
  });

  fastify.post('/admin/resume', async (_request, reply) => {
    opts.schedulerEnabled.value = true;
    return reply.send({ resumed: true });
  });

  fastify.get('/admin/status', async (_request, reply) => {
    return reply.send({ schedulerEnabled: opts.schedulerEnabled.value });
  });
};
