import type { ProjectStatus } from './types.js';

const validTransitions: ReadonlyMap<ProjectStatus, readonly ProjectStatus[]> = new Map([
  ['Inbox', ['Triaged', 'Snoozed']],
  ['Triaged', ['Ready', 'Snoozed', 'Blocked']],
  ['Ready', ['Queued', 'Snoozed', 'Blocked']],
  ['Queued', ['AgentRunning', 'Blocked', 'Ready']],
  ['AgentRunning', ['PROpen', 'Blocked', 'NeedsReview']],
  ['PROpen', ['NeedsReview', 'Blocked', 'Merged']],
  ['NeedsReview', ['Merged', 'Blocked', 'PROpen']],
  ['Blocked', ['Ready', 'Triaged']],
  ['Merged', []],
  ['Snoozed', []],
]);

export function canTransitionProjectStatus(from: ProjectStatus, to: ProjectStatus): boolean {
  if (from === to) {
    return true;
  }
  const allowed = validTransitions.get(from);
  return allowed?.includes(to) ?? false;
}
