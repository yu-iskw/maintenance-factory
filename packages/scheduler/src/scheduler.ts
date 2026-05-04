import cron from 'node-cron';

import type { HourlyJobDeps } from './hourly-job';
import { runHourlyJob } from './hourly-job';

export interface SchedulerHandle {
  stop: () => void;
}

export function startScheduler(
  deps: Omit<HourlyJobDeps, 'activeRunCount'>,
  cronExpression = '0 * * * *',
): SchedulerHandle {
  const activeRunCount = { value: 0 };
  const jobDeps: HourlyJobDeps = { ...deps, activeRunCount };

  const task = cron.schedule(cronExpression, async () => {
    if (!deps.config.schedulerEnabled) return;
    try {
      await runHourlyJob(jobDeps);
    } catch (err) {
      console.error('[scheduler] hourly job failed:', err);
    }
  });

  return {
    stop: () => task.stop(),
  };
}
