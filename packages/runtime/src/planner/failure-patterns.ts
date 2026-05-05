/**
 * RFC §13.1 / §17.2 — infer repeated failure themes from recent agent run summaries (pure, no I/O).
 */
export interface AgentRunFailureRow {
  repoFullName: string;
  taskType: string;
  status: string;
  errorSummary?: string;
}

interface FailureGroup {
  repoFullName: string;
  taskType: string;
  sample: string;
  count: number;
}

/**
 * Group failed runs by repo + coarse error token and return human-readable bullets for Hermes output.
 */
export function inferRepeatedFailurePatterns(
  runs: AgentRunFailureRow[],
  options?: { minFailures?: number },
): string[] {
  const min = options?.minFailures ?? 2;
  const failed = runs.filter((r) => r.status.trim().toLowerCase() === 'failed');
  const keyCounts = new Map<string, FailureGroup>();
  for (const r of failed) {
    const token =
      (r.errorSummary ?? 'unknown_error').split('\n')[0]?.slice(0, 120) ?? 'unknown_error';
    const key = `${r.repoFullName}\0${r.taskType}\0${token}`;
    const prev = keyCounts.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      keyCounts.set(key, {
        repoFullName: r.repoFullName,
        taskType: r.taskType,
        sample: token,
        count: 1,
      });
    }
  }
  const out: string[] = [];
  for (const g of keyCounts.values()) {
    if (g.count < min) {
      continue;
    }
    out.push(`${g.repoFullName} (${g.taskType}): ${g.count}× failures — ${g.sample}`);
  }
  out.sort();
  return out;
}
