import * as fs from 'node:fs';

import * as yaml from 'js-yaml';

import { policyConfigSchema } from './schema';

import type { PolicyConfig } from '@maintenance-factory/types';

export function loadPolicy(filePath: string): PolicyConfig {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  const validated = policyConfigSchema.parse(parsed);
  return validated as PolicyConfig;
}
