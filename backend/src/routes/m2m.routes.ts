import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { outlets, pdus, outletStateHistory } from '../db/schema';
import { logger } from '../utils/logger';
import { WebSocketService } from '../services/websocket.service';
import { m2mAuth } from '../middleware/m2m-auth';

export const m2mRoutes = new Elysia({ prefix: '/m2m' })
  .use(m2mAuth)

  // Get outlet state
  .get('/outlets/:outletId', async ({ params, db, set }) => {
    const [outlet] = await db
      .select({
        id: outlets.id,
        name: outlets.name,
        outletNumber: outlets.outletNumber,
        actualState: outlets.actualState,
        desiredState: outlets.desiredState,
        lastStateChange: outlets.lastStateChange,
        pduId: outlets.pduId,
        pduName: pdus.name,
        pduIp: pdus.ipAddress,
      })
      .from(outlets)
      .innerJoin(pdus, eq(outlets.pduId, pdus.id))
      .where(eq(outlets.id, params.outletId))
      .limit(1);

    if (!outlet) {
      set.status = 404;
      return { error: 'Outlet not found' };
    }

    return {
      id: outlet.id,
      name: outlet.name,
      outletNumber: outlet.outletNumber,
      state: outlet.actualState,
      desiredState: outlet.desiredState,
      lastStateChange: outlet.lastStateChange,
      pdu: {
        id: outlet.pduId,
        name: outlet.pduName,
        ip: outlet.pduIp,
      },
    };
  }, {
    params: t.Object({
      outletId: t.String({ format: 'uuid' })
    })
  })

  // Turn outlet ON
  .post('/outlets/:outletId/on', async ({ params, db, snmpService, set }) => {
    return await controlOutlet(params.outletId, 'on', db, snmpService, set);
  }, {
    params: t.Object({
      outletId: t.String({ format: 'uuid' })
    })
  })

  // Turn outlet OFF
  .post('/outlets/:outletId/off', async ({ params, db, snmpService, set }) => {
    return await controlOutlet(params.outletId, 'off', db, snmpService, set);
  }, {
    params: t.Object({
      outletId: t.String({ format: 'uuid' })
    })
  });

// Shared outlet control logic
async function controlOutlet(
  outletId: string,
  state: 'on' | 'off',
  db: any,
  snmpService: any,
  set: any
) {
  const [outlet] = await db
    .select({
      outlet: outlets,
      pdu: pdus,
    })
    .from(outlets)
    .innerJoin(pdus, eq(outlets.pduId, pdus.id))
    .where(eq(outlets.id, outletId))
    .limit(1);

  if (!outlet) {
    set.status = 404;
    return { error: 'Outlet not found' };
  }

  try {
    await snmpService.setOutletPower(
      outlet.pdu,
      outlet.outlet.outletNumber,
      state
    );

    await db
      .update(outlets)
      .set({
        actualState: state,
        lastStateChange: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(outlets.id, outletId));

    await db.insert(outletStateHistory).values({
      outletId: outletId,
      previousState: outlet.outlet.actualState,
      newState: state,
      changeType: 'manual',
      initiatedBy: 'm2m-api',
      success: true,
    });

    const wsService = WebSocketService.getInstance();
    wsService.broadcast('outlet:state-changed', {
      pduId: outlet.pdu.id,
      outletId: outletId,
      outletNumber: outlet.outlet.outletNumber,
      newState: state,
    });

    logger.info({
      pdu: outlet.pdu.name,
      outlet: outlet.outlet.outletNumber,
      state,
      source: 'm2m-api',
    }, 'M2M outlet power state changed');

    return {
      success: true,
      outlet: {
        id: outletId,
        name: outlet.outlet.name,
        state: state,
      },
    };
  } catch (error: any) {
    logger.error({
      error: error.message,
      outlet: outlet.outlet.outletNumber,
      source: 'm2m-api',
    }, 'M2M failed to change outlet power state');

    await db.insert(outletStateHistory).values({
      outletId: outletId,
      previousState: outlet.outlet.actualState,
      newState: state,
      changeType: 'manual',
      initiatedBy: 'm2m-api',
      success: false,
      errorMessage: error.message,
    });

    set.status = 500;
    return {
      success: false,
      error: error.message,
    };
  }
}
