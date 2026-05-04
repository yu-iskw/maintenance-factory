import { eq } from 'drizzle-orm';

import { repoProfiles } from '../schema';

import type { Db } from '../client';
import type { NewRepoProfileRow, RepoProfileRow } from '../schema/repo-profiles';

export async function upsertRepoProfile(
  db: Db,
  profile: NewRepoProfileRow,
): Promise<RepoProfileRow> {
  const [upserted] = await db
    .insert(repoProfiles)
    .values(profile)
    .onConflictDoUpdate({
      target: repoProfiles.repoFullName,
      set: {
        ownerTeam: profile.ownerTeam,
        repoCriticality: profile.repoCriticality,
        primaryLanguage: profile.primaryLanguage,
        packageManagers: profile.packageManagers,
        defaultBranch: profile.defaultBranch,
        codeownersPresent: profile.codeownersPresent,
        testCommands: profile.testCommands,
        buildCommands: profile.buildCommands,
        forbiddenPaths: profile.forbiddenPaths,
        runtimeJson: profile.runtimeJson,
        notes: profile.notes,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!upserted) throw new Error(`Failed to upsert repo profile: ${profile.repoFullName}`);
  return upserted;
}

export async function getRepoProfile(
  db: Db,
  repoFullName: string,
): Promise<RepoProfileRow | undefined> {
  return db.query.repoProfiles.findFirst({
    where: eq(repoProfiles.repoFullName, repoFullName),
  });
}
