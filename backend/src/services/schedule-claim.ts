import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { scheduledOperations } from '../db/schema';

export async function claimScheduledOperation(
  db: Pick<PostgresJsDatabase<any>, 'update'>,
  operationId: string,
  executedAt: Date = new Date()
): Promise<any | null> {
  const [claimed] = await db
    .update(scheduledOperations)
    .set({ executed: true, executedAt })
    .where(and(
      eq(scheduledOperations.id, operationId),
      eq(scheduledOperations.executed, false)
    ))
    .returning();

  return claimed ?? null;
}
