import { z } from 'zod';

const taskTypeSchema = z.enum([
  'dependabot_shepherd',
  'direct_security_patch',
  'dependency_freshness_patch',
  'repo_hygiene_scan',
  'repo_hygiene_config_pr',
  'ci_diagnosis',
]);

const riskSchema = z.enum(['Low', 'Medium', 'High', 'Critical']);

const repoCriticalityPolicySchema = z.object({
  scheduledRuns: z.boolean(),
  maxConcurrentRuns: z.number().int().positive().optional(),
  requiredReviews: z.array(z.string()),
});

const taskPolicySchema = z.object({
  allowedRisk: z.array(riskSchema).optional(),
  allowedScopes: z.array(z.string()).optional(),
  requireAdvisoryReference: z.boolean().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
});

const repoOverrideSchema = z.object({
  repo: z.string(),
  enabled: z.boolean().optional(),
  reason: z.string().optional(),
  maxRunsPerDay: z.number().int().positive().optional(),
  allowedTaskTypes: z.array(taskTypeSchema).optional(),
});

export const policyConfigSchema = z.object({
  version: z.literal(1),
  global: z.object({
    neverAutoMerge: z.boolean(),
    maxGlobalConcurrentRuns: z.number().int().positive(),
    maxRunsPerRepo: z.number().int().positive(),
    maxRunsPerOwnerTeam: z.number().int().positive(),
    maxDailyRuns: z.number().int().positive(),
    retryLimitPerTask: z.number().int().nonnegative(),
  }),
  allowedTaskTypes: z.array(taskTypeSchema),
  forbiddenPaths: z.array(z.string()),
  repoCriticality: z.object({
    standard: repoCriticalityPolicySchema,
    sensitive: repoCriticalityPolicySchema,
    critical: repoCriticalityPolicySchema,
  }),
  taskPolicies: z.record(taskTypeSchema, taskPolicySchema).optional(),
  repoOverrides: z.array(repoOverrideSchema).optional(),
});

export type ValidatedPolicyConfig = z.infer<typeof policyConfigSchema>;
