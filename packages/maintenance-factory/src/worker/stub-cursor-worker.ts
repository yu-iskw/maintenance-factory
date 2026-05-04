import type { MaintenanceWorker, WorkerLaunchInput, WorkerLaunchResult } from './maintenance-worker.js';

/**
 * Placeholder executor when `@cursor/sdk` is wired by the host environment.
 * Never merges; only records intent.
 */
export class StubCursorWorker implements MaintenanceWorker {
  async launch(input: WorkerLaunchInput): Promise<WorkerLaunchResult> {
    if (input.dryRun) {
      return { cursorRunId: `dry-run:${input.runUuid}`, dryRun: true };
    }
    return { cursorRunId: `stub:${input.runUuid}`, dryRun: false };
  }
}
