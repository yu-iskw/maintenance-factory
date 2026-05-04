export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function parseRepoFullName(repoFullName: string): [string, string] {
  const slash = repoFullName.indexOf('/');
  if (slash < 1 || slash === repoFullName.length - 1) {
    throw new Error(`Invalid repo full name: ${repoFullName}`);
  }
  return [repoFullName.slice(0, slash), repoFullName.slice(slash + 1)];
}
