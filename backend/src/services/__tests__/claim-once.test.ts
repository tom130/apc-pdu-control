import { describe, expect, test } from 'bun:test';
import { claimScheduledOperation } from '../schedule-claim';

function createClaimDb() {
  let executed = false;
  return {
    update() {
      return {
        set(values: Record<string, unknown>) {
          expect(values).toMatchObject({ executed: true });
          expect(values.executedAt).toBeInstanceOf(Date);
          return {
            where(condition: unknown) {
              expect(condition).toBeTruthy();
              return {
                async returning() {
                  await Bun.sleep(1);
                  if (executed) return [];
                  executed = true;
                  return [{ id: 'operation-1', operation: 'off' }];
                },
              };
            },
          };
        },
      };
    },
  };
}

describe('claimScheduledOperation', () => {
  test('concurrent claims return one operation once', async () => {
    const db = createClaimDb();

    const claims = await Promise.all([
      claimScheduledOperation(db as any, 'operation-1', new Date('2026-06-03T00:00:00Z')),
      claimScheduledOperation(db as any, 'operation-1', new Date('2026-06-03T00:00:00Z')),
      claimScheduledOperation(db as any, 'operation-1', new Date('2026-06-03T00:00:00Z')),
    ]);

    expect(claims.filter(Boolean)).toEqual([{ id: 'operation-1', operation: 'off' }]);
  });
});
