import type { PoolClient } from 'pg';

export interface RepoProfileRow {
  repo_full_name: string;
  owner_team: string | null;
  codeowners_present: boolean | null;
  default_branch: string | null;
  primary_language: string | null;
  package_managers: string[];
  repo_criticality: string;
  test_commands: string[];
  build_commands: string[];
  forbidden_paths: string[];
  notes: string | null;
}

export async function upsertRepoProfile(
  client: PoolClient,
  row: Omit<
    RepoProfileRow,
    'package_managers' | 'test_commands' | 'build_commands' | 'forbidden_paths'
  > &
    Partial<
      Pick<
        RepoProfileRow,
        'package_managers' | 'test_commands' | 'build_commands' | 'forbidden_paths'
      >
    >,
): Promise<void> {
  await client.query(
    `INSERT INTO repo_profiles (
       repo_full_name, owner_team, codeowners_present, default_branch, primary_language,
       package_managers, repo_criticality, test_commands, build_commands, forbidden_paths, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (repo_full_name) DO UPDATE SET
       owner_team = EXCLUDED.owner_team,
       codeowners_present = EXCLUDED.codeowners_present,
       default_branch = EXCLUDED.default_branch,
       primary_language = EXCLUDED.primary_language,
       package_managers = EXCLUDED.package_managers,
       repo_criticality = EXCLUDED.repo_criticality,
       test_commands = EXCLUDED.test_commands,
       build_commands = EXCLUDED.build_commands,
       forbidden_paths = EXCLUDED.forbidden_paths,
       notes = EXCLUDED.notes,
       updated_at = now()`,
    [
      row.repo_full_name,
      row.owner_team,
      row.codeowners_present,
      row.default_branch,
      row.primary_language,
      row.package_managers ?? [],
      row.repo_criticality,
      row.test_commands ?? [],
      row.build_commands ?? [],
      row.forbidden_paths ?? [],
      row.notes,
    ],
  );
}
