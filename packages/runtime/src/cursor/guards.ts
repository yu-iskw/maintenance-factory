/**
 * Runtime guard: agents must never perform merge operations.
 */
export function assertNeverAutoMerge(enabled: boolean): void {
  if (!enabled) {
    throw new Error('never_auto_merge must be true for cursor-worker');
  }
}

export function forbidMergeCall(operation: string): never {
  throw new Error(`Autonomous merge is forbidden: attempted ${operation}`);
}
