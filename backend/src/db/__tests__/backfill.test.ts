import { describe, expect, test } from 'bun:test';
import { backfillSnapshot } from '../backfill';

interface Row {
  id: string;
  desiredState: string | null;
  actualState: string | null;
}

function createDb(rows: Row[]) {
  return {
    update() {
      return {
        set(values: Record<string, unknown>) {
          expect(values).toHaveProperty('desiredState');
          return {
            where(condition: unknown) {
              expect(condition).toBeTruthy();
              return {
                returning() {
                  const updated: Array<{ id: string }> = [];
                  for (const row of rows) {
                    if (row.desiredState === null && row.actualState !== null) {
                      row.desiredState = row.actualState;
                      updated.push({ id: row.id });
                    }
                  }
                  return updated;
                },
              };
            },
          };
        },
      };
    },
  };
}

describe('backfillSnapshot', () => {
  test('targets only NULL snapshots and is idempotent', async () => {
    const rows: Row[] = [
      { id: 'null-on', desiredState: null, actualState: 'on' },
      { id: 'null-off', desiredState: null, actualState: 'off' },
      { id: 'existing', desiredState: 'off', actualState: 'on' },
      { id: 'unknown', desiredState: null, actualState: null },
    ];
    const db = createDb(rows);

    await expect(backfillSnapshot(db as any)).resolves.toBe(2);
    expect(rows).toEqual([
      { id: 'null-on', desiredState: 'on', actualState: 'on' },
      { id: 'null-off', desiredState: 'off', actualState: 'off' },
      { id: 'existing', desiredState: 'off', actualState: 'on' },
      { id: 'unknown', desiredState: null, actualState: null },
    ]);

    await expect(backfillSnapshot(db as any)).resolves.toBe(0);
  });
});
