import type { FailurePattern } from '@maintenance-factory/types';

interface RunRecord {
  repoFullName: string;
  errorMessage: string | null;
  startedAt: Date;
}

export function detectFailurePatterns(runs: RunRecord[]): FailurePattern[] {
  const patternMap = new Map<
    string,
    { count: number; repos: Set<string>; first: Date; last: Date }
  >();

  for (const run of runs) {
    if (!run.errorMessage) continue;

    const pattern = normalizeError(run.errorMessage);
    const existing = patternMap.get(pattern) ?? {
      count: 0,
      repos: new Set<string>(),
      first: run.startedAt,
      last: run.startedAt,
    };

    existing.count++;
    existing.repos.add(run.repoFullName);
    if (run.startedAt < existing.first) existing.first = run.startedAt;
    if (run.startedAt > existing.last) existing.last = run.startedAt;
    patternMap.set(pattern, existing);
  }

  return Array.from(patternMap.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([pattern, v]) => ({
      pattern,
      count: v.count,
      affectedRepos: Array.from(v.repos),
      firstSeenAt: v.first,
      lastSeenAt: v.last,
    }))
    .sort((a, b) => b.count - a.count);
}

function normalizeError(message: string): string {
  return message
    .replace(/\d+/g, 'N')
    .replace(/[a-f0-9]{40}/g, '<sha>')
    .trim()
    .slice(0, 120);
}
