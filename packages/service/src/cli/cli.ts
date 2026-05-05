#!/usr/bin/env node
import {
  createGraphqlClient,
  createOctokit,
  listOpenDependabotPulls,
  syncDependabotShepherdTasksToProject,
} from '@maintenance-factory/github';

function usage(): string {
  return `Usage: maintenance-factory link-dependabot-prs <owner> <repo> <projectNodeId>

Links open Dependabot PRs for the repository to the given GitHub Projects v2 board (idempotent).

Environment:
  GITHUB_TOKEN   PAT or installation token with project:write and pull_requests:read

Example:
  export GITHUB_TOKEN=...
  maintenance-factory link-dependabot-prs my-org my-service PVT_kwDOBC5...
`;
}

async function main(): Promise<void> {
  const [, , cmd, owner, repo, projectNodeId] = process.argv;
  if (cmd !== 'link-dependabot-prs' || !owner || !repo || !projectNodeId) {
    console.error(usage());
    process.exit(1);
  }
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    console.error('GITHUB_TOKEN is required');
    process.exit(1);
  }

  const octokit = createOctokit(token);
  const graphql = createGraphqlClient(token);

  const tasks = await listOpenDependabotPulls(octokit, owner, repo);
  const rows = await syncDependabotShepherdTasksToProject(graphql, projectNodeId, tasks);
  console.log(JSON.stringify({ owner, repo, projectNodeId, rows }, null, 2));
}

void main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
