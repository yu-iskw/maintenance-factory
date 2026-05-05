# Maintenance factory — end-user guide

This guide is for **people who use or govern** the maintenance factory: repository owners, CODEOWNERS, security/platform engineers, and **operators** who run tooling against GitHub. It stays at the **behavior and process** level; implementation details for coding agents live in [AGENTS.md](../AGENTS.md).

For rollout, governance, and pilot steps, see [maintenance-factory-rollout.md](./maintenance-factory-rollout.md).

---

## 1. What this system is for

**Goal:** Reduce security and dependency **backlog** across many GitHub repositories while keeping **every merge human-controlled**.

**How it helps:**

- Puts work on a **GitHub Project** board so teams see the same queue.
- **Scans** repositories for Dependabot PRs, alerts (where permitted), and hygiene signals.
- Can **link** open Dependabot PRs to the Project so cards stay in sync with real PRs.
- **Policy** decides whether a **scheduled** autonomous coding run is allowed (risk, repo criticality, limits, kill switches).
- A **Cursor SDK–based worker** can propose **branches and pull requests** for a single repo and task — it does **not** merge.

**Explicit non-goals (v1):**

- **No autonomous merge.** Reviewers and branch protection stay in charge.
- **No** broad refactors, secrets rotation in automation, or production deploys from the worker.
- **Hermes-style** outputs in this repo are **planning / reporting text** (for example weekly summaries), not a second actor that pushes code.

---

## 2. Who does what

| Role                              | Responsibility                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Repository owner / CODEOWNERS** | Review and merge (or reject) PRs; keep repo metadata accurate.                                                               |
| **Security / platform**           | Approve GitHub App permissions, policy YAML, criticality labels, kill-switch drills.                                         |
| **Operator**                      | Runs CLI and dry-runs, checks webhook health, observes board and audit tables, engages kill switches when needed.            |
| **Engineering manager**           | Uses Project views and metrics (where wired) for backlog and blocked work — not a separate tool login if you live in GitHub. |

---

## 3. Concepts in plain language

| Term                    | Meaning for you                                                                                                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Project (v2)** | The **canonical board**: columns/fields represent task state. Humans can edit fields; automation reconciles from GitHub events where configured.                                                                              |
| **Maintenance task**    | One unit of work (for example “shepherd Dependabot PR #42” or “address alert X”) with type, risk, and repo.                                                                                                                   |
| **Policy**              | Rules (YAML) for **whether** a scheduled agent run is allowed — not for merging.                                                                                                                                              |
| **Dry-run**             | “Look but don’t take irreversible action” mode for parts of the pipeline (for example scheduling without acquiring a lock, or scanning without writing to the Project). Exact flags depend on the entrypoint your team wires. |
| **Kill switch**         | A **pause** you can flip (global, per-repo, per task type, etc.) so new agent runs stop while scans or the board can continue.                                                                                                |
| **Audit record**        | A **standard** row of metadata about a run (task, policy outcome, PR link when known, etc.) — **not** a full transcript of the agent chat by default.                                                                         |

---

## 4. What you need before day one

Work with your platform or GitHub admin to ensure:

1. **GitHub App** (or token) with **least privilege** for your goals — at minimum, what your operator workflows use (Projects read/write, pull requests read, checks read, Dependabot alerts read where approved, etc.).
2. A **GitHub Project v2** whose **custom fields** match what your organization agreed (see your internal RFC or field checklist). Field **names** must align with what your automation maps (your engineering team configures this).
3. **Branch protection** on default branches: required reviews (including CODEOWNERS where applicable), required checks, and **no** “bypass” for the maintenance app unless your security team explicitly approves an exception.
4. **Policy file** with `never_auto_merge: true` (or equivalent) so automation never treats merge as allowed.

---

## 5. Operator: build tooling and run the CLI

From a checkout of this repository:

```bash
pnpm install
pnpm build
```

Link **open Dependabot pull requests** for one repository to a Project (by GraphQL **project node id**). This is **idempotent**: PRs already on the board are skipped safely.

```bash
export GITHUB_TOKEN=...   # PAT or installation token with the right scopes
pnpm maintenance-factory -- link-dependabot-prs <org-or-owner> <repo-name> <projectNodeId>
```

**Example:**

```bash
pnpm maintenance-factory -- link-dependabot-prs acme-corp payments-api PVT_kwDOAbc123...
```

**Output:** JSON with one row per scanned Dependabot task:

- **`projectItemNodeId`** — the Project item node id when the PR was linked (or already linked).
- **`skippedReason`** — when present, explains why a row was not linked. Common values:
  - **`missing_pr_content_node_id`** — GitHub did not return a GraphQL node id for the PR in the REST payload your environment saw; fix tooling or upgrade client paths with your engineering team.
  - **`not_dependabot_shepherd`** — the row was not a Dependabot shepherd task (other task types need different flows).

**Permissions (typical):** token must be able to **read** pull requests in the repo and **mutate** the target Project (add project item). Your admin confirms exact scopes.

---

## 6. Webhooks and “live” updates

When your team deploys the **HTTP webhook** entrypoint (`control-plane-http`):

- GitHub sends signed events (for example pull request open/merge, checks).
- The receiver verifies the signature and derives **field updates** for the Project.
- **Applying** those updates to GitHub GraphQL is done in your deployment layer (your team wires `onProjectFieldUpdates` to call the Projects API with your field id map).

**End-user expectation:** after checks pass or a PR merges, the **board** should reflect reality within the latency your operators configure (webhook delivery + worker).

---

## 7. Safety: merges, reviews, and kill switches

- **Merges:** Only humans (or your normal GitHub flows) merge. The worker prompt and policy posture assume **no merge** from automation.
- **Reviews:** CODEOWNERS and branch protection remain the **source of truth** for who must approve; the factory does not replace them.
- **Kill switches:** Use them during incidents, policy experiments, or budget freezes. After a **global** pause, scheduled runs should **deny** with a clear reason until the pause is cleared. Your operator runbook should include a short drill (see [rollout doc](./maintenance-factory-rollout.md)).

---

## 8. Repo owners & reviewers: what to expect on PRs

When a maintenance agent opens or updates a PR, you should see:

- A normal **pull request** against your default branch (or the branch your policy allows).
- A **title and body** that state the task type, risk, and that the change is **agent-generated** and must be **reviewed and merged manually**.
- **Validation** claims in the body — treat them like any other PR: re-run CI, read the diff, and request changes if scope creeps.

**Red flags to reject:**

- Changes outside the stated dependency or fix (large refactors, unrelated files).
- Touches to sensitive paths your organization forbids (auth, billing, prod infra, secrets) unless the task explicitly allows them.

---

## 9. Security & privacy notes

- **Tokens:** Treat `GITHUB_TOKEN` like any production secret; prefer short-lived installation tokens where possible.
- **Audit:** Rows are meant for **governance**, not full chat logs. Do not paste secrets or production logs into fields that get stored.
- **Alerts:** Dependabot and security APIs may return **403** in some orgs; your board may be incomplete until permissions are fixed — that is an **admin** issue, not a reviewer problem.

---

## 10. Troubleshooting (quick)

| Symptom                                | What to check                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| CLI prints `GITHUB_TOKEN is required`  | Export a non-empty token in the same shell.                                                                      |
| Many `missing_pr_content_node_id` rows | Engineering: REST payload / Octokit version / task builder must supply PR `node_id`.                             |
| GraphQL errors on link                 | Token scopes; correct **project** node id; org vs user project URL.                                              |
| Board not updating on events           | Webhook delivery in GitHub settings; signature secret; deployment wired to GraphQL field updates.                |
| Scheduler never runs work              | Kill switches; policy deny reasons; candidates not supplied from Project query (integration gap your team owns). |

---

## 11. Where to read next

| Document                                                           | Audience                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| [AGENTS.md](../AGENTS.md)                                          | Anyone **developing** or extending the monorepo.     |
| [maintenance-factory-rollout.md](./maintenance-factory-rollout.md) | Platform / security **rollout** and drills.          |
| [README.md](../README.md)                                          | Template **clone** orientation and pnpm entrypoints. |

---

## 12. Glossary

| Term                      | Short definition                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| **Dependabot shepherd**   | Help an **existing** Dependabot PR get green (conflicts, checks), without widening scope.         |
| **Direct security patch** | A PR created to address a **security alert** when no suitable PR exists yet (policy-gated).       |
| **Reconciler**            | Logic that turns GitHub events into **Project field updates** (for example PR merged → status).   |
| **Scheduler**             | Component that picks **eligible** work and, when integrated, respects policy, locks, and dry-run. |

If something in this guide disagrees with your organization’s **internal RFC**, your internal RFC wins — treat this file as the **default** narrative for this repository’s layout.
