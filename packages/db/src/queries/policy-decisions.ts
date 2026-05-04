import type { Db } from '../client';
import { policyDecisions } from '../schema';
import type { NewPolicyDecisionRow, PolicyDecisionRow } from '../schema/policy-decisions';

export async function insertPolicyDecision(
  db: Db,
  decision: NewPolicyDecisionRow,
): Promise<PolicyDecisionRow> {
  const [inserted] = await db.insert(policyDecisions).values(decision).returning();
  if (!inserted) throw new Error('Failed to insert policy decision');
  return inserted;
}
