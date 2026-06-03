import { describe, expect, test } from 'bun:test';
import { SNMPService } from '../snmp.service';

function walk(service: SNMPService, session: any, oid: string): Promise<any[]> {
  return (service as any).walkOID(session, oid);
}

describe('SNMP walk timeout handling', () => {
  test('rejects when the SNMP walk times out', async () => {
    const service = new SNMPService();
    const timeout = Object.assign(new Error('request timed out'), {
      name: 'RequestTimedOutError',
    });
    const session = {
      walk(_oid: string, _maxRepetitions: number, _feed: any, done: any) {
        done(timeout);
      },
    };

    await expect(walk(service, session, '1.2.3')).rejects.toThrow('request timed out');
  });

  test('resolves partial results for NoSuchName walk errors', async () => {
    const service = new SNMPService();
    const noSuchName = Object.assign(new Error('NoSuchName'), {
      name: 'RequestFailedError',
    });
    const session = {
      walk(oid: string, _maxRepetitions: number, feed: any, done: any) {
        feed([
          { oid: `${oid}.1`, value: 'first' },
          { oid: '9.9.9', value: 'outside subtree' },
        ]);
        done(noSuchName);
      },
    };

    await expect(walk(service, session, '1.2.3')).resolves.toEqual([
      { oid: '1.2.3.1', value: 'first' },
    ]);
  });
});
