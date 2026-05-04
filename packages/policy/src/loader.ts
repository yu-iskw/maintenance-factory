import * as fs from 'node:fs';

import * as yaml from 'js-yaml';

import type { PolicyConfig } from '@maintenance-factory/types';

import { policyConfigSchema } from './schema';

export function loadPolicy(filePath: string): PolicyConfig {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  const validated = policyConfigSchema.parse(parsed);
  return validated as PolicyConfig;
}
