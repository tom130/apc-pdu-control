import { describe, expect, test } from 'bun:test';
import { createPduLock } from '../pdu-lock';

describe('createPduLock', () => {
  test('serializes same-PDU work', async () => {
    const { withPduLock } = createPduLock();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = withPduLock('pdu-1', async () => {
      events.push('first:start');
      await firstBlocked;
      events.push('first:end');
    });
    const second = withPduLock('pdu-1', async () => {
      events.push('second');
    });

    await Bun.sleep(0);
    expect(events).toEqual(['first:start']);

    releaseFirst();
    await Promise.all([first, second]);

    expect(events).toEqual(['first:start', 'first:end', 'second']);
  });

  test('parallelizes cross-PDU work', async () => {
    const { withPduLock } = createPduLock();
    const events: string[] = [];
    let release!: () => void;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = withPduLock('pdu-1', async () => {
      events.push('pdu-1:start');
      await blocker;
    });
    const second = withPduLock('pdu-2', async () => {
      events.push('pdu-2:start');
    });

    await second;
    expect(events).toEqual(['pdu-1:start', 'pdu-2:start']);

    release();
    await first;
  });

  test('does not wedge after a throwing task', async () => {
    const { withPduLock } = createPduLock();
    const failure = new Error('boom');

    await expect(withPduLock('pdu-1', async () => {
      throw failure;
    })).rejects.toThrow('boom');

    await expect(withPduLock('pdu-1', async () => 'after')).resolves.toBe('after');
  });
});
