/**
 * Octokit / @octokit/request errors often expose HTTP status on `error.status`.
 */
export function httpStatusFromUnknown(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  if (!('status' in error)) {
    return undefined;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}
