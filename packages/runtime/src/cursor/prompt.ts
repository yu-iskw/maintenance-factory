import type { MaintenanceTask, RepoProfile } from '@maintenance-factory/core';

export interface PromptContext {
  repoFullName: string;
  taskType: string;
  taskTitle: string;
  taskBody: string;
  risk: string;
  repoCriticality: string;
  allowedPaths: string[];
  forbiddenPaths: string[];
  validationCommands: string[];
  repoProfileYaml: string;
  promptTemplateVersion: string;
}

export function renderMaintenancePrompt(ctx: PromptContext): string {
  return `You are a code maintenance agent.
Repository:
${ctx.repoFullName}
Task type:
${ctx.taskType}
Task:
${ctx.taskTitle}
Context:
${ctx.taskBody}
Risk:
${ctx.risk}
Repo criticality:
${ctx.repoCriticality}
Allowed changes:
${ctx.allowedPaths.join(', ') || '(none specified)'}
Forbidden changes:
${ctx.forbiddenPaths.join(', ') || '(none)'}
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
${ctx.validationCommands.map((c) => `- ${c}`).join('\n')}
Repository profile:
${ctx.repoProfileYaml}
Prompt template version: ${ctx.promptTemplateVersion}
`;
}

export function promptContextFromTask(
  task: MaintenanceTask,
  profile: RepoProfile,
  allowedPaths: string[],
  validationCommands: string[],
  promptTemplateVersion: string,
): PromptContext {
  return {
    repoFullName: task.repoFullName,
    taskType: task.taskType,
    taskTitle: task.title,
    taskBody: task.body ?? '',
    risk: task.risk,
    repoCriticality: task.repoCriticality,
    allowedPaths,
    forbiddenPaths: profile.forbiddenPaths,
    validationCommands,
    repoProfileYaml: JSON.stringify(
      {
        repo: profile.repoFullName,
        owner_team: profile.ownerTeam,
        repo_criticality: profile.repoCriticality,
        validation: { test_commands: profile.testCommands, build_commands: profile.buildCommands },
        forbidden_paths: profile.forbiddenPaths,
      },
      null,
      2,
    ),
    promptTemplateVersion,
  };
}
