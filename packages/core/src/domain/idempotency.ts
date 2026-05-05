import type { MaintenanceTaskType } from './types.js';

/**
 * Stable key for deduplicating Project items: repo + task type + external alert/PR id.
 */
export function computeIdempotencyKey(
  repoFullName: string,
  taskType: MaintenanceTaskType,
  externalAlertOrPrId: string,
): string {
  const normalizedRepo = repoFullName.trim().toLowerCase();
  const normalizedExternal = externalAlertOrPrId.trim();
  return `${normalizedRepo}::${taskType}::${normalizedExternal}`;
}
