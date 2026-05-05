/** Standard audit fields (RFC §15); no raw transcripts by default. */
export interface AgentRunAudit {
  runUuid: string;
  githubProjectItemId: string;
  repoFullName: string;
  taskType: string;
  severity?: string;
  risk: string;
  repoCriticality: string;
  policyDecision: string;
  policyReason?: string;
  policyVersion: string;
  promptTemplateVersion: string;
  cursorRunId?: string;
  branchName?: string;
  prUrl?: string;
  status: string;
  filesChangedSummary?: string;
  validationCommands: string[];
  validationSummary?: string;
  checkSummary?: string;
  reviewerOutcome?: string;
  errorSummary?: string;
  startedAt?: string;
  completedAt?: string;
}

const secretPatterns: RegExp[] = [
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /bearer\s+\S+/gi,
  /ghp_[A-Za-z0-9]+/g,
  /gho_[A-Za-z0-9]+/g,
  /github_pat_[A-Za-z0-9_]+/g,
];

/**
 * Redact likely secrets from free-text summaries before persistence.
 */
export function redactSummary(text: string): string {
  let out = text;
  for (const pattern of secretPatterns) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

/**
 * Reject values that look like full transcripts or excessive length.
 */
export function assertNoTranscriptField(
  name: string,
  value: string | undefined,
  maxLength = 16_384,
): void {
  if (value === undefined) {
    return;
  }
  if (value.length > maxLength) {
    throw new RangeError(`${name} exceeds maximum length for standard audit storage`);
  }
  const lower = value.toLowerCase();
  if (lower.includes('user:') && lower.includes('assistant:') && value.length > 2000) {
    throw new RangeError(`${name} appears to contain transcript-style content`);
  }
}
