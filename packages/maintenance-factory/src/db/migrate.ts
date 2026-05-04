import { SCHEMA_SQL } from './schema-sql.js';

import type { Pool, PoolClient } from 'pg';

export async function applySchema(client: PoolClient | Pool): Promise<void> {
  await client.query(SCHEMA_SQL);
}
