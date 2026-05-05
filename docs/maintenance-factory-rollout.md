# Maintenance factory rollout

This document tracks **Phase 8** governance and rollout for the GitHub-native maintenance factory implemented in `packages/*`.

**End users** (operators, owners, reviewers): start with [end-user-guide.md](./end-user-guide.md).

## Preconditions

- GitHub App permissions reviewed and least-privilege approved.
- GitHub Projects v2 board created with RFC §8.2 fields.
- Branch protection: required reviews, required checks, no bypass for the maintenance app.
- `never_auto_merge: true` in policy YAML and enforced in worker (`@maintenance-factory/runtime`).

## Kill switch drill

1. Insert `kill_switches` row: `scope=global`, `scope_key=''`, `paused=true` via `upsertKillSwitch`.
2. Run scheduler dry-run: decisions should be **deny** with reason `Global scheduler pause`.
3. Clear pause (`paused=false`) and verify scheduling resumes in sandbox.

## Audit retention

- Standard audit: use `agent_runs` and `policy_decisions` tables (`@maintenance-factory/runtime`).
- Do **not** store raw transcripts by default; use `assertNoTranscriptField` from `@maintenance-factory/core`.

## Pilot (10–20 standard repos)

1. Phase 1–2: inventory + reconciler only (no Cursor runs).
2. Phase 3: Dependabot shepherding pilot with `dryRun: true`, then single live run.
3. Measure: PR quality, reviewer rejection rate, blocked rate.

## CI parity

From repo root:

```bash
pnpm lint:eslint && pnpm knip && pnpm build && pnpm test
```

## References

- Packages: `@maintenance-factory/core`, `@maintenance-factory/github`, `@maintenance-factory/runtime`, `@maintenance-factory/service` (plus template `packages/common`).
