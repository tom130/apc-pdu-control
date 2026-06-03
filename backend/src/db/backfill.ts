import { and, isNotNull, isNull, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { outlets } from './schema';

export async function backfillSnapshot(db: Pick<PostgresJsDatabase<any>, 'update'>): Promise<number> {
  const updated = await db
    .update(outlets)
    .set({ desiredState: sql`${outlets.actualState}` })
    .where(and(
      isNull(outlets.desiredState),
      isNotNull(outlets.actualState)
    ))
    .returning({ id: outlets.id });

  return updated.length;
}
