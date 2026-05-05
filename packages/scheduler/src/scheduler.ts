import { schedule } from 'node-cron';

import { runHourlyJob } from './hourly-job';

import type { HourlyJobDeps } from './hourly-job';

export interface SchedulerHandle {
  stop: () => void;
}

export function startScheduler(
  deps: Omit<HourlyJobDeps, 'activeRunCount'>,
  cronExpression = '0 * * * *',
): SchedulerHandle {
  const activeRunCount = { value: 0 };
  const jobDeps: HourlyJobDeps = { ...deps, activeRunCount };

  const task = schedule(cronExpression, () => {
    if (!deps.config.schedulerEnabled) return;
    void runHourlyJob(jobDeps).catch((err) => {
      console.error('[scheduler] hourly job failed:', err);
    });
  });

  return {
    stop: () => task.stop(),
  };
}
