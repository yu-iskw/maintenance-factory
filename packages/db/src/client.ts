import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export type Db = ReturnType<typeof createClient>;

export function createClient(databaseUrl: string): ReturnType<typeof drizzle<typeof schema>> {
  const sql = postgres(databaseUrl, { max: 10 });
  return drizzle(sql, { schema });
}
