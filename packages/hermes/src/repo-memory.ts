import { getRepoProfile, upsertRepoProfile } from '@maintenance-factory/db';

import type { Db } from '@maintenance-factory/db';
import type { RepoProfile } from '@maintenance-factory/types';

export async function readRepoProfile(
  db: Db,
  repoFullName: string,
): Promise<RepoProfile | undefined> {
  const row = await getRepoProfile(db, repoFullName);
  if (!row) return undefined;
  return {
    repoFullName: row.repoFullName,
    ownerTeam: row.ownerTeam ?? undefined,
    repoCriticality: row.repoCriticality as RepoProfile['repoCriticality'],
    primaryLanguage: row.primaryLanguage ?? undefined,
    packageManagers: row.packageManagers ?? undefined,
    testCommands: row.testCommands ?? undefined,
    buildCommands: row.buildCommands ?? undefined,
    forbiddenPaths: row.forbiddenPaths ?? undefined,
    notes: row.notes ? [row.notes] : undefined,
    updatedAt: row.updatedAt,
  };
}

export async function writeRepoProfile(db: Db, profile: RepoProfile): Promise<void> {
  await upsertRepoProfile(db, {
    repoFullName: profile.repoFullName,
    ownerTeam: profile.ownerTeam,
    repoCriticality: profile.repoCriticality,
    primaryLanguage: profile.primaryLanguage,
    packageManagers: profile.packageManagers,
    testCommands: profile.testCommands,
    buildCommands: profile.buildCommands,
    forbiddenPaths: profile.forbiddenPaths,
    notes: profile.notes?.join('\n'),
    updatedAt: new Date(),
  });
}
