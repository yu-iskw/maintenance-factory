import {
  reconcileFromCheckRun,
  reconcileFromCheckSuite,
  reconcileFromPullRequest,
  reconcileFromPullRequestReview,
  type ProjectFieldUpdate,
} from './project-fields.js';

export function reconcileWebhookEvent(eventName: string, payload: unknown): ProjectFieldUpdate[] {
  switch (eventName) {
    case 'pull_request':
      return reconcileFromPullRequest(payload);
    case 'pull_request_review':
      return reconcileFromPullRequestReview(payload);
    case 'check_run':
      return reconcileFromCheckRun(payload);
    case 'check_suite':
      return reconcileFromCheckSuite(payload);
    default:
      return [];
  }
}
