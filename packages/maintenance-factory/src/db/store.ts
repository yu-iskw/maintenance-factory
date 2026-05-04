import type { Pool } from 'pg';

export type AgentRunInsert = {
  runUuid: string;
  githubProjectItemId?: string;
  repoFullName: string;
  ownerTeam?: string;
  taskType: string;
  severity?: string;
  risk: string;
  repoCriticality: string;
  policyDecision: string;
  policyReason?: string;
  promptTemplateVersion: string;
  cursorRunId?: string;
  branchName?: string;
  prUrl?: string;
  status: string;
  filesChangedSummary?: string;
  validationCommands?: string[];
  validationSummary?: string;
  checkSummary?: string;
  reviewerOutcome?: string;
  errorSummary?: string;
  startedAt?: Date;
  completedAt?: Date;
};

export class MaintenanceStore {
  constructor(private readonly pool: Pool) {}

  async isGlobalPaused(): Promise<boolean> {
    const result = await this.pool.query<{ paused: boolean }>(
      `select paused from kill_switches where scope = 'global' limit 1`,
    );
    return result.rows[0]?.paused === true;
  }

  async isRepoPaused(repoFullName: string): Promise<boolean> {
    const result = await this.pool.query<{ paused: boolean }>(
      `select paused from kill_switches where scope = $1 limit 1`,
      [`repo:${repoFullName}`],
    );
    return result.rows[0]?.paused === true;
  }

  async isTaskTypePaused(taskType: string): Promise<boolean> {
    const result = await this.pool.query<{ paused: boolean }>(
      `select paused from kill_switches where scope = $1 limit 1`,
      [`task:${taskType}`],
    );
    return result.rows[0]?.paused === true;
  }

  async setKillSwitch(scope: string, paused: boolean): Promise<void> {
    await this.pool.query(
      `insert into kill_switches (scope, paused, updated_at)
       values ($1, $2, now())
       on conflict (scope) do update set paused = excluded.paused, updated_at = now()`,
      [scope, paused],
    );
  }

  async insertPolicyDecision(input: {
    githubProjectItemId?: string;
    repoFullName: string;
    taskType: string;
    decision: string;
    reason?: string;
    policyVersion: string;
  }): Promise<void> {
    await this.pool.query(
      `insert into policy_decisions (github_project_item_id, repo_full_name, task_type, decision, reason, policy_version)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        input.githubProjectItemId ?? null,
        input.repoFullName,
        input.taskType,
        input.decision,
        input.reason ?? null,
        input.policyVersion,
      ],
    );
  }

  async updateAgentRunByUuid(
    runUuid: string,
    patch: Partial<{
      status: string;
      cursorRunId: string;
      errorSummary: string;
      completedAt: Date;
      prUrl: string;
      branchName: string;
    }>,
  ): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (patch.status !== undefined) {
      sets.push(`status = $${i++}`);
      values.push(patch.status);
    }
    if (patch.cursorRunId !== undefined) {
      sets.push(`cursor_run_id = $${i++}`);
      values.push(patch.cursorRunId);
    }
    if (patch.errorSummary !== undefined) {
      sets.push(`error_summary = $${i++}`);
      values.push(patch.errorSummary);
    }
    if (patch.completedAt !== undefined) {
      sets.push(`completed_at = $${i++}`);
      values.push(patch.completedAt);
    }
    if (patch.prUrl !== undefined) {
      sets.push(`pr_url = $${i++}`);
      values.push(patch.prUrl);
    }
    if (patch.branchName !== undefined) {
      sets.push(`branch_name = $${i++}`);
      values.push(patch.branchName);
    }
    if (sets.length === 0) {
      return;
    }
    values.push(runUuid);
    await this.pool.query(`update agent_runs set ${sets.join(', ')} where run_uuid = $${i}`, values);
  }

  async insertAgentRun(row: AgentRunInsert): Promise<void> {
    await this.pool.query(
      `insert into agent_runs (
        run_uuid, github_project_item_id, repo_full_name, owner_team, task_type, severity, risk, repo_criticality,
        policy_decision, policy_reason, prompt_template_version, cursor_run_id, branch_name, pr_url, status,
        files_changed_summary, validation_commands, validation_summary, check_summary, reviewer_outcome,
        error_summary, started_at, completed_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
      )`,
      [
        row.runUuid,
        row.githubProjectItemId ?? null,
        row.repoFullName,
        row.ownerTeam ?? null,
        row.taskType,
        row.severity ?? null,
        row.risk,
        row.repoCriticality,
        row.policyDecision,
        row.policyReason ?? null,
        row.promptTemplateVersion,
        row.cursorRunId ?? null,
        row.branchName ?? null,
        row.prUrl ?? null,
        row.status,
        row.filesChangedSummary ?? null,
        row.validationCommands ?? null,
        row.validationSummary ?? null,
        row.checkSummary ?? null,
        row.reviewerOutcome ?? null,
        row.errorSummary ?? null,
        row.startedAt ?? null,
        row.completedAt ?? null,
      ],
    );
  }

  async countRunsStartedSince(repoFullName: string, since: Date): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `select count(*)::text as count from agent_runs
       where repo_full_name = $1 and started_at is not null and started_at >= $2`,
      [repoFullName, since],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countRunningForRepo(repoFullName: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `select count(*)::text as count from agent_runs where repo_full_name = $1 and status = 'running'`,
      [repoFullName],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countRunningForCriticalRepos(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `select count(*)::text as count
       from agent_runs ar
       join repo_profiles rp on rp.repo_full_name = ar.repo_full_name
       where ar.status = 'running' and rp.repo_criticality = 'critical'`,
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countRunningForOwnerTeam(ownerTeam: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `select count(*)::text as count from agent_runs where status = 'running' and coalesce(owner_team, 'unknown') = $1`,
      [ownerTeam],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countGlobalRunning(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `select count(*)::text as count from agent_runs where status = 'running'`,
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countRunsStartedToday(): Promise<number> {
    const startOfUtcDay = new Date();
    startOfUtcDay.setUTCHours(0, 0, 0, 0);
    const result = await this.pool.query<{ count: string }>(
      `select count(*)::text as count from agent_runs where started_at >= $1`,
      [startOfUtcDay],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async tryAcquireLock(key: string, repoFullName: string, projectItemId: string | undefined, ttlMs: number) {
    const expiresAt = new Date(Date.now() + ttlMs);
    try {
      const result = await this.pool.query(
        `insert into scheduler_locks (key, repo_full_name, github_project_item_id, expires_at)
         values ($1, $2, $3, $4)`,
        [key, repoFullName, projectItemId ?? null, expiresAt],
      );
      return result.rowCount === 1;
    } catch {
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    await this.pool.query(`delete from scheduler_locks where key = $1`, [key]);
  }

  async upsertRepoProfile(input: {
    repoFullName: string;
    ownerTeam?: string;
    codeownersPresent?: boolean;
    defaultBranch?: string;
    primaryLanguage?: string;
    packageManagers?: string[];
    repoCriticality: string;
    testCommands?: string[];
    buildCommands?: string[];
    forbiddenPaths?: string[];
    notes?: string;
  }): Promise<void> {
    await this.pool.query(
      `insert into repo_profiles (
        repo_full_name, owner_team, codeowners_present, default_branch, primary_language, package_managers,
        repo_criticality, test_commands, build_commands, forbidden_paths, notes, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
      on conflict (repo_full_name) do update set
        owner_team = coalesce(excluded.owner_team, repo_profiles.owner_team),
        codeowners_present = coalesce(excluded.codeowners_present, repo_profiles.codeowners_present),
        default_branch = coalesce(excluded.default_branch, repo_profiles.default_branch),
        primary_language = coalesce(excluded.primary_language, repo_profiles.primary_language),
        package_managers = coalesce(excluded.package_managers, repo_profiles.package_managers),
        repo_criticality = excluded.repo_criticality,
        test_commands = coalesce(excluded.test_commands, repo_profiles.test_commands),
        build_commands = coalesce(excluded.build_commands, repo_profiles.build_commands),
        forbidden_paths = coalesce(excluded.forbidden_paths, repo_profiles.forbidden_paths),
        notes = coalesce(excluded.notes, repo_profiles.notes),
        updated_at = now()`,
      [
        input.repoFullName,
        input.ownerTeam ?? null,
        input.codeownersPresent ?? null,
        input.defaultBranch ?? null,
        input.primaryLanguage ?? null,
        input.packageManagers ?? null,
        input.repoCriticality,
        input.testCommands ?? null,
        input.buildCommands ?? null,
        input.forbiddenPaths ?? null,
        input.notes ?? null,
      ],
    );
  }
}
