import type { MaintenanceTaskType } from '../domain/types.js';

const CMD_INSTALL = 'pnpm install';
const CMD_TEST = 'pnpm test';
const CMD_BUILD = 'pnpm build';
const CMD_LINT = 'pnpm lint';
const CMD_AUDIT = 'pnpm audit';

export interface WorkflowMetadata {
  taskType: MaintenanceTaskType;
  /** Suggested validation commands when repo profile does not override */
  defaultValidationCommands: string[];
  /** Allowed in v1 scheduled pilot */
  scheduledInPilot: boolean;
  /** Manual-only workflows */
  manualOnly: boolean;
}

export const workflowRegistry: WorkflowMetadata[] = [
  {
    taskType: 'dependabot_shepherd',
    defaultValidationCommands: [CMD_INSTALL, CMD_TEST, CMD_BUILD],
    scheduledInPilot: true,
    manualOnly: false,
  },
  {
    taskType: 'direct_security_patch',
    defaultValidationCommands: [CMD_INSTALL, CMD_TEST, CMD_AUDIT],
    scheduledInPilot: true,
    manualOnly: false,
  },
  {
    taskType: 'dependency_freshness_patch',
    defaultValidationCommands: [CMD_INSTALL, CMD_TEST],
    scheduledInPilot: true,
    manualOnly: false,
  },
  {
    taskType: 'repo_hygiene_scan',
    defaultValidationCommands: [CMD_LINT],
    scheduledInPilot: true,
    manualOnly: false,
  },
  {
    taskType: 'repo_hygiene_config_pr',
    defaultValidationCommands: [CMD_LINT, CMD_TEST],
    scheduledInPilot: true,
    manualOnly: false,
  },
  {
    taskType: 'ci_diagnosis',
    defaultValidationCommands: [CMD_TEST],
    scheduledInPilot: true,
    manualOnly: false,
  },
];

export function workflowFor(taskType: MaintenanceTaskType): WorkflowMetadata | undefined {
  return workflowRegistry.find((w) => w.taskType === taskType);
}

/** RFC §11.2-style classes that must never be automated in v1 (not in MaintenanceTaskType union). */
export const manualOnlyOutOfBandTaskTypes = [
  'major_upgrade',
  'secrets_remediation',
  'infra_modernization',
  'auth_billing_crypto',
] as const;
