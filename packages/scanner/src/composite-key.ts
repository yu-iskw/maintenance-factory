export function buildCompositeKey(
  scanner: string,
  taskType: string,
  repoFullName: string,
  externalId: string | number,
): string {
  return `${scanner}:${taskType}:${repoFullName}:${externalId}`;
}
