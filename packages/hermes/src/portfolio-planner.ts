import Anthropic from '@anthropic-ai/sdk';

import type { RepoProfile, WeeklySummary } from '@maintenance-factory/types';

const HERMES_MODEL = 'claude-sonnet-4-6';

export async function generateWeeklyPlan(
  apiKey: string,
  repoProfiles: RepoProfile[],
  openTaskCount: number,
  highSeverityCount: number,
  stalePrCount: number,
): Promise<WeeklySummary> {
  const client = new Anthropic({ apiKey });

  const profilesJson = JSON.stringify(
    repoProfiles.map((p) => ({
      repo: p.repoFullName,
      criticality: p.repoCriticality,
      team: p.ownerTeam,
      notes: p.notes,
    })),
    null,
    2,
  );

  const response = await client.messages.create({
    model: HERMES_MODEL,
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: 'You are Hermes, a maintenance factory portfolio planner. You analyze repository maintenance backlogs and produce actionable weekly plans. Always respond in valid JSON matching the WeeklySummary schema.',
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: `Repository profiles:\n${profilesJson}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Generate a weekly maintenance plan. Stats: ${openTaskCount} open tasks, ${highSeverityCount} high severity, ${stalePrCount} stale Dependabot PRs. Return JSON matching this TypeScript type:
{
  generatedAt: string (ISO date),
  openTaskCount: number,
  highSeverityCount: number,
  staleDependabotPrCount: number,
  criticalRepoAlertCount: number,
  reposMissingCodeowners: number,
  recommendedRuns: Array<{ description: string, repoFullName: string, taskType: string, priority: number }>,
  risks: string[],
  suggestedPolicyChanges: string[],
  failurePatterns: []
}`,
      },
    ],
  });

  const content = response.content[0];
  if (content?.type !== 'text') {
    throw new Error('Unexpected response type from Hermes');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Hermes response');

  const parsed = JSON.parse(jsonMatch[0]) as Omit<WeeklySummary, 'generatedAt'> & {
    generatedAt: string;
  };
  return { ...parsed, generatedAt: new Date(parsed.generatedAt) };
}
