import type { Pool } from 'pg';

export type HermesPortfolioSnapshot = {
  day: string;
  openRuns: number;
  failedRuns7d: number;
  topFailureSignatures: Array<{ signature: string; count: number; exampleRepo?: string }>;
};

export async function loadHermesPortfolioSnapshot(pool: Pool): Promise<HermesPortfolioSnapshot> {
  const open = await pool.query<{ c: string }>(`select count(*)::text as c from agent_runs where status = 'running'`);
  const failed = await pool.query<{ c: string }>(
    `select count(*)::text as c from agent_runs where status = 'failed' and coalesce(started_at, created_at) >= now() - interval '7 days'`,
  );
  const sigs = await pool.query<{ signature: string; count: number; example_repo: string | null }>(
    `select signature, count, example_repo from failure_signatures order by count desc limit 5`,
  );
  return {
    day: new Date().toISOString().slice(0, 10),
    openRuns: Number(open.rows[0]?.c ?? 0),
    failedRuns7d: Number(failed.rows[0]?.c ?? 0),
    topFailureSignatures: sigs.rows.map((r) => ({
      signature: r.signature,
      count: r.count,
      exampleRepo: r.example_repo ?? undefined,
    })),
  };
}

export function renderWeeklyMaintenancePlan(snapshot: HermesPortfolioSnapshot): string {
  return `# Weekly Maintenance Plan

## Summary
- Open agent runs: ${snapshot.openRuns}
- Failed runs (last 7 days): ${snapshot.failedRuns7d}

## Top failure signatures
${snapshot.topFailureSignatures
  .map((s) => `- ${s.signature} (count=${s.count}${s.exampleRepo ? `, example=${s.exampleRepo}` : ''})`)
  .join('\n')}

## Recommended next actions
1. Shepherd stale Dependabot PRs where Agent Eligible is true.
2. Patch high-severity Dependabot alerts with advisory references.
3. Refresh repo profiles missing test commands.

## Suggested policy changes
- Keep major upgrades manual.
- Pause ecosystems with repeated failures until profiles are fixed.
`;
}
