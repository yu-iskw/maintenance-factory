import { describe, expect, it } from 'vitest';

import { INIT_SCHEMA_SQL, splitSchemaStatements } from './migrate.js';

describe('splitSchemaStatements', () => {
  it('splits init schema into one statement per DDL object', () => {
    const parts = splitSchemaStatements(INIT_SCHEMA_SQL);
    expect(parts.length).toBe(6);
    expect(parts.every((p) => p.toUpperCase().startsWith('CREATE TABLE'))).toBe(true);
  });
});
