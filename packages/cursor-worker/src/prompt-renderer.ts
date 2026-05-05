import type { WorkerTask } from '@maintenance-factory/types';

const PROMPT_TEMPLATE_VERSION = '1.0.0';

export function renderPrompt(task: WorkerTask): string {
  const profile = task.repoProfile;
  return `You are a code maintenance agent.

Repository: ${task.repoFullName}
Task type: ${task.taskType}
Task: ${task.taskTitle}
Context: ${task.taskBody}
Risk: ${task.risk}
Repo criticality: ${task.repoCriticality}

Allowed changes:
${task.allowedPaths?.join('\n') ?? '(no restrictions)'}

Forbidden changes:
${task.forbiddenPaths?.join('\n') ?? '(none)'}

Rules:
1. Make the smallest safe change.
2. Do not refactor unrelated code.
3. Do not modify production deployment, secrets, migrations, auth, billing, or infra unless the task explicitly allows it.
4. Do not broaden dependency upgrades beyond the target package/family.
5. Prefer lockfile-only changes when safe.
6. Run the validation commands listed below.
7. If validation cannot run, explain why.
8. Open a pull request.
9. Do not merge.
10. PR body must include: Summary, Risk level, Files changed, Commands run, Test results, Residual risk, Reviewer notes.

Validation commands:
${task.validationCommands?.join('\n') ?? 'pnpm test\npnpm build'}

Repository profile:
${profile ? JSON.stringify(profile, null, 2) : '(no profile available)'}
`;
}

export function getPromptTemplateVersion(): string {
  return PROMPT_TEMPLATE_VERSION;
}
