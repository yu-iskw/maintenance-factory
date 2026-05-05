import { eq } from 'drizzle-orm';

import { agentRuns } from '../schema';

import type { Db } from '../client';
import type { AgentRunRow, NewAgentRunRow } from '../schema/agent-runs';

export async function insertAgentRun(db: Db, run: NewAgentRunRow): Promise<AgentRunRow> {
  const [inserted] = await db.insert(agentRuns).values(run).returning();
  if (!inserted) throw new Error('Failed to insert agent run');
  return inserted;
}

export async function updateAgentRunStatus(
  db: Db,
  id: string,
  update: Partial<
    Pick<
      AgentRunRow,
      | 'status'
      | 'completedAt'
      | 'prUrl'
      | 'branchName'
      | 'filesChangedSummary'
      | 'validationSummary'
      | 'checkSummary'
      | 'errorMessage'
    >
  >,
): Promise<AgentRunRow> {
  const [updated] = await db.update(agentRuns).set(update).where(eq(agentRuns.id, id)).returning();
  if (!updated) throw new Error(`Agent run not found: ${id}`);
  return updated;
}

export async function getAgentRunByCompositeKey(
  db: Db,
  compositeKey: string,
): Promise<AgentRunRow | undefined> {
  return db.query.agentRuns.findFirst({
    where: eq(agentRuns.compositeKey, compositeKey),
  });
}

export async function listActiveRunsForRepo(db: Db, repoFullName: string): Promise<AgentRunRow[]> {
  return db.query.agentRuns.findMany({
    where: (t, { and, inArray }) =>
      and(eq(t.repoFullName, repoFullName), inArray(t.status, ['PENDING', 'RUNNING'])),
  });
}
