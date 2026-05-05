/**
 * RFC §14.3 suggested branch naming: `agent/{task_type}/{repo_slug}/{external_id}`.
 */
function slugSegment(raw: string, maxLen: number): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

export function maintenanceAgentBranchName(
  taskType: string,
  repoFullName: string,
  externalId: string,
): string {
  const repoSlug = slugSegment(repoFullName, 48);
  const typeSlug = slugSegment(taskType, 48);
  const ext = externalId.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 64);
  return `agent/${typeSlug}/${repoSlug}/${ext}`;
}
