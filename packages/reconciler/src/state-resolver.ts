import type { CheckStatus, PullRequest, TaskStatus } from '@maintenance-factory/types';

export function resolveProjectState(
  currentStatus: TaskStatus,
  pr: PullRequest | null,
  checks: CheckStatus | null,
): TaskStatus {
  if (!pr) {
    if (currentStatus === 'PR Open' || currentStatus === 'Needs Review') {
      return 'Blocked';
    }
    return currentStatus;
  }

  if (pr.state === 'merged') {
    return 'Merged';
  }

  if (pr.state === 'closed') {
    return 'Blocked';
  }

  // PR is open
  if (checks) {
    if (checks.state === 'failure' || checks.state === 'error') {
      return 'Blocked';
    }
    if (checks.state === 'success') {
      return 'Needs Review';
    }
  }

  return 'PR Open';
}
