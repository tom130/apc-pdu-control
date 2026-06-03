import { describe, expect, test } from 'bun:test';
import { createRestoreGuard } from '../restore-guard';

describe('restore guard', () => {
  test('prevents overlapping restore runs for the same PDU', async () => {
    const guard = createRestoreGuard();
    let release!: () => void;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    let runs = 0;

    const first = guard.run('pdu-1', async () => {
      runs++;
      await blocker;
      return 'first';
    });
    const second = await guard.run('pdu-1', async () => {
      runs++;
      return 'second';
    });

    expect(second).toEqual({ started: false });
    expect(runs).toBe(1);

    release();
    await expect(first).resolves.toEqual({ started: true, value: 'first' });
  });

  test('allows cross-PDU and post-completion restore runs', async () => {
    const guard = createRestoreGuard();

    const same = await Promise.all([
      guard.run('pdu-1', async () => 'one'),
      guard.run('pdu-2', async () => 'two'),
    ]);
    const again = await guard.run('pdu-1', async () => 'again');

    expect(same).toEqual([
      { started: true, value: 'one' },
      { started: true, value: 'two' },
    ]);
    expect(again).toEqual({ started: true, value: 'again' });
  });
});
