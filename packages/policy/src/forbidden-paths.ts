import micromatch from 'micromatch';

export function isForbiddenPath(filePath: string, forbiddenPatterns: string[]): boolean {
  return micromatch.isMatch(filePath, forbiddenPatterns);
}

export function filterForbiddenPaths(
  filePaths: string[],
  forbiddenPatterns: string[],
): { allowed: string[]; forbidden: string[] } {
  const allowed: string[] = [];
  const forbidden: string[] = [];
  for (const path of filePaths) {
    if (isForbiddenPath(path, forbiddenPatterns)) {
      forbidden.push(path);
    } else {
      allowed.push(path);
    }
  }
  return { allowed, forbidden };
}
