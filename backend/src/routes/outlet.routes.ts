import { Elysia, t } from 'elysia';
import { eq, and, desc } from 'drizzle-orm';
import { pdus, outlets, outletStateHistory } from '../db/schema';
import { OutletState } from '../utils/constants';
import { logger } from '../utils/logger';
import { WebSocketService } from '../services/websocket.service';

export const outletRoutes = new Elysia({ prefix: '/pdus/:pduId/outlets' })
  .get('/', async ({ params, db }) => {
    const pduOutlets = await db
      .select()
      .from(outlets)
      .where(eq(outlets.pduId, params.pduId))
      .orderBy(outlets.outletNumber);
    
    return pduOutlets;
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' })
    })
  })
  
  .get('/:outletId', async ({ params, db, set }) => {
    const [outlet] = await db
      .select()
      .from(outlets)
      .where(
        and(
          eq(outlets.pduId, params.pduId),
          eq(outlets.id, params.outletId)
        )
      )
      .limit(1);
    
    if (!outlet) {
      set.status = 404;
      return { error: 'Outlet not found' };
    }
    
    return outlet;
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' }),
      outletId: t.String({ format: 'uuid' })
    })
  })
  
  .put('/:outletId', async ({ params, body, db, set }) => {
    const [updated] = await db
      .update(outlets)
      .set({ ...body, updatedAt: new Date() })
      .where(
        and(
          eq(outlets.pduId, params.pduId),
          eq(outlets.id, params.outletId)
        )
      )
      .returning();
    
    if (!updated) {
      set.status = 404;
      return { error: 'Outlet not found' };
    }
    
    return updated;
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' }),
      outletId: t.String({ format: 'uuid' })
    }),
    body: t.Partial(t.Object({
      name: t.String(),
      description: t.String(),
      isCritical: t.Boolean(),
      autoRecovery: t.Boolean(),
    }))
  })
  
  .post('/:outletId/power', async ({ params, body, db, snmpService, set }) => {
    // Get the outlet and PDU
    const [outlet] = await db
      .select({
        outlet: outlets,
        pdu: pdus
      })
      .from(outlets)
      .innerJoin(pdus, eq(outlets.pduId, pdus.id))
      .where(
        and(
          eq(outlets.pduId, params.pduId),
          eq(outlets.id, params.outletId)
        )
      )
      .limit(1);
    
    if (!outlet) {
      set.status = 404;
      return { error: 'Outlet not found' };
    }
    
    try {
      // Apply power state via SNMP
      await snmpService.setOutletPower(
        outlet.pdu,
        outlet.outlet.outletNumber,
        body.state
      );
      
      // Update database
      await db
        .update(outlets)
        .set({
          actualState: body.state,
          lastStateChange: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(outlets.id, params.outletId));
      
      // Log state change
      await db.insert(outletStateHistory).values({
        outletId: params.outletId,
        previousState: outlet.outlet.actualState,
        newState: body.state,
        changeType: 'manual',
        initiatedBy: 'user',
        success: true,
      });
      
      // Broadcast WebSocket event
      const wsService = WebSocketService.getInstance();
      wsService.broadcast('outlet:state-changed', {
        pduId: params.pduId,
        outletId: params.outletId,
        outletNumber: outlet.outlet.outletNumber,
        newState: body.state,
      });
      
      logger.info({
        pdu: outlet.pdu.name,
        outlet: outlet.outlet.outletNumber,
        state: body.state
      }, 'Outlet power state changed');
      
      return {
        success: true,
        newState: body.state
      };
    } catch (error: any) {
      logger.error({
        error: error.message,
        outlet: outlet.outlet.outletNumber
      }, 'Failed to change outlet power state');
      
      // Log failed attempt
      await db.insert(outletStateHistory).values({
        outletId: params.outletId,
        previousState: outlet.outlet.actualState,
        newState: body.state,
        changeType: 'manual',
        initiatedBy: 'user',
        success: false,
        errorMessage: error.message,
      });
      
      set.status = 500;
      return {
        success: false,
        error: error.message
      };
    }
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' }),
      outletId: t.String({ format: 'uuid' })
    }),
    body: t.Object({
      state: t.Union([
        t.Literal('on'),
        t.Literal('off'),
        t.Literal('reboot')
      ])
    })
  })
  
  .post('/:outletId/desired-state', async ({ params, body, db }) => {
    const [updated] = await db
      .update(outlets)
      .set({
        desiredState: body.state,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(outlets.pduId, params.pduId),
          eq(outlets.id, params.outletId)
        )
      )
      .returning();
    
    if (!updated) {
      throw new Error('Outlet not found');
    }
    
    logger.info({
      outlet: updated.outletNumber,
      desiredState: body.state
    }, 'Outlet desired state updated');
    
    return updated;
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' }),
      outletId: t.String({ format: 'uuid' })
    }),
    body: t.Object({
      state: t.Union([
        t.Literal('on'),
        t.Literal('off'),
        t.Literal('reboot'),
        t.Null()
      ])
    })
  })
  
  .get('/:outletId/history', async ({ params, query, db }) => {
    const history = await db
      .select()
      .from(outletStateHistory)
      .where(eq(outletStateHistory.outletId, params.outletId))
      .orderBy(desc(outletStateHistory.timestamp))
      .limit(query.limit || 50);
    
    return history;
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' }),
      outletId: t.String({ format: 'uuid' })
    }),
    query: t.Object({
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100 }))
    })
  })
  
  .post('/bulk', async ({ params, body, db, snmpService, set }) => {
    const [pdu] = await db
      .select()
      .from(pdus)
      .where(eq(pdus.id, params.pduId))
      .limit(1);
    
    if (!pdu) {
      set.status = 404;
      return { error: 'PDU not found' };
    }
    
    try {
      await snmpService.setAllOutlets(pdu, body.operation);
      
      // Update all outlets in database
      await db
        .update(outlets)
        .set({
          actualState: body.operation,
          lastStateChange: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(outlets.pduId, params.pduId));
      
      // Broadcast WebSocket event
      const wsService = WebSocketService.getInstance();
      wsService.broadcast('outlets:bulk-changed', {
        pduId: params.pduId,
        operation: body.operation,
      });
      
      logger.info({
        pdu: pdu.name,
        operation: body.operation
      }, 'Bulk outlet operation completed');
      
      return {
        success: true,
        affected: await db
          .select({ count: outlets.id })
          .from(outlets)
          .where(eq(outlets.pduId, params.pduId))
          .then(r => r.length)
      };
    } catch (error: any) {
      logger.error({
        error: error.message,
        pdu: pdu.name
      }, 'Bulk outlet operation failed');
      
      set.status = 500;
      return {
        success: false,
        error: error.message
      };
    }
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' })
    }),
    body: t.Object({
      operation: t.Union([
        t.Literal('on'),
        t.Literal('off'),
        t.Literal('reboot')
      ])
    })
  });