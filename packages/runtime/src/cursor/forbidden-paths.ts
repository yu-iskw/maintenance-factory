const PLACEHOLDER_DOUBLE_STAR = '\uE000__DS__\uE000';
const PLACEHOLDER_SINGLE_STAR = '\uE000__SS__\uE000';
const PLACEHOLDER_QUESTION = '\uE000__Q__\uE000';

function globWithDoubleStarsToRegExp(pattern: string): RegExp {
  let s = pattern.split('**').join(PLACEHOLDER_DOUBLE_STAR);
  s = s.split('*').join(PLACEHOLDER_SINGLE_STAR);
  s = s.split('?').join(PLACEHOLDER_QUESTION);
  s = s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  s = s.split(PLACEHOLDER_DOUBLE_STAR).join('.*');
  s = s.split(PLACEHOLDER_SINGLE_STAR).join('[^/]*');
  s = s.split(PLACEHOLDER_QUESTION).join('.');
  // eslint-disable-next-line security/detect-non-literal-regexp -- built from escaped policy glob
  return new RegExp(`^${s}$`);
}

/**
 * Minimal glob-style matcher for RFC forbidden_paths (single `**` segment).
 */
export function pathMatchesForbidden(filePath: string, pattern: string): boolean {
  const normalized = filePath.split('\\').join('/');
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return normalized === prefix || normalized.startsWith(`${prefix}/`);
  }
  if (pattern.includes('**')) {
    return globWithDoubleStarsToRegExp(pattern).test(normalized);
  }
  return normalized === pattern || normalized.startsWith(`${pattern}/`);
}

export function assertChangesAllowed(
  changedFiles: string[],
  forbiddenPatterns: string[],
): { ok: true } | { ok: false; blocked: string[] } {
  const blocked: string[] = [];
  for (const file of changedFiles) {
    for (const pattern of forbiddenPatterns) {
      if (pathMatchesForbidden(file, pattern)) {
        blocked.push(`${file} matches ${pattern}`);
      }
    }
  }
  if (blocked.length > 0) {
    return { ok: false, blocked };
  }
  return { ok: true };
}
