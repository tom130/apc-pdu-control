import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '../../../..');

describe('snapshot restore source model', () => {
  test('scheduler does not run periodic desired-state reconciliation', () => {
    const scheduler = readFileSync(join(root, 'backend/src/services/scheduler.service.ts'), 'utf8');

    expect(scheduler).not.toContain('INTERVALS.RECONCILE');
    expect(scheduler).not.toContain('reconcileAllStates');
  });

  test('scheduler does not trigger restore from reboot-skew heuristics', () => {
    const scheduler = readFileSync(join(root, 'backend/src/services/scheduler.service.ts'), 'utf8');

    expect(scheduler).not.toContain('detectReboot');
    expect(scheduler).not.toContain('recoverFromReboot');
  });

  test('backend routes do not expose desired-state enforcement controls', () => {
    const outletRoutes = readFileSync(join(root, 'backend/src/routes/outlet.routes.ts'), 'utf8');
    const pduRoutes = readFileSync(join(root, 'backend/src/routes/pdu.routes.ts'), 'utf8');

    expect(outletRoutes).not.toContain('desired-state');
    expect(pduRoutes).not.toContain('/:pduId/reconcile');
    expect(pduRoutes).not.toContain('/:pduId/recover');
  });

  test('control paths do not persist reboot as an outlet state', () => {
    const outletRoutes = readFileSync(join(root, 'backend/src/routes/outlet.routes.ts'), 'utf8');
    const scheduler = readFileSync(join(root, 'backend/src/services/scheduler.service.ts'), 'utf8');

    expect(outletRoutes).not.toContain('actualState: body.state');
    expect(outletRoutes).not.toContain('actualState: body.operation');
    expect(scheduler).not.toContain("actualState: operation === 'reboot'");
  });

  test('corrective write paths use the shared PDU lock', () => {
    const stateManager = readFileSync(join(root, 'backend/src/services/state-manager.service.ts'), 'utf8');
    const scheduler = readFileSync(join(root, 'backend/src/services/scheduler.service.ts'), 'utf8');
    const outletRoutes = readFileSync(join(root, 'backend/src/routes/outlet.routes.ts'), 'utf8');
    const m2mRoutes = readFileSync(join(root, 'backend/src/routes/m2m.routes.ts'), 'utf8');

    expect(stateManager).toContain('withPduLock(');
    expect(scheduler).toContain('withPduLock(');
    expect(outletRoutes).toContain('withPduLock(');
    expect(m2mRoutes).toContain('withPduLock(');
  });
});
