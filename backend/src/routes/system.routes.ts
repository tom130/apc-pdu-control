import { Elysia, t } from 'elysia';
import { eq, desc, sql } from 'drizzle-orm';
import { pdus, outlets, pduEvents } from '../db/schema';

export const systemRoutes = new Elysia()
  .get('/system/health', async ({ db, stateManager }) => {
    // Get PDU counts
    const allPdus = await db.select().from(pdus);
    const activePdus = allPdus.filter(p => p.isActive);
    
    // Get outlet counts
    const allOutlets = await db.select().from(outlets);
    
    // Calculate state skew
    const skewedOutlets = allOutlets.filter(
      o => o.desiredState && o.desiredState !== o.actualState
    );
    const stateSkewPercentage = allOutlets.length > 0
      ? (skewedOutlets.length / allOutlets.length) * 100
      : 0;
    
    // Calculate average response time (mock for now)
    const averageResponseTime = 50; // ms
    
    return {
      totalPdus: allPdus.length,
      activePdus: activePdus.length,
      totalOutlets: allOutlets.length,
      stateSkewPercentage,
      averageResponseTime,
      lastSystemCheck: new Date().toISOString(),
    };
  })
  
  .get('/events', async ({ query, db }) => {
    const events = await db
      .select({
        event: pduEvents,
        pduName: pdus.name,
      })
      .from(pduEvents)
      .leftJoin(pdus, eq(pduEvents.pduId, pdus.id))
      .orderBy(desc(pduEvents.timestamp))
      .limit(query.limit || 100);
    
    return events.map(e => ({
      ...e.event,
      pduName: e.pduName,
    }));
  }, {
    query: t.Object({
      limit: t.Optional(t.Number({ minimum: 1, maximum: 500 }))
    })
  })
  
  .get('/scheduled-operations', async ({ query, db }) => {
    const scheduledOperations = await import('../db/schema').then(m => m.scheduledOperations);
    
    let queryBuilder = db
      .select()
      .from(scheduledOperations)
      .where(eq(scheduledOperations.executed, false))
      .$dynamic();
    
    if (query.outletId) {
      queryBuilder = queryBuilder.where(eq(scheduledOperations.outletId, query.outletId));
    }
    
    const operations = await queryBuilder
      .orderBy(scheduledOperations.scheduledTime)
      .limit(100);
    
    return operations;
  }, {
    query: t.Object({
      outletId: t.Optional(t.String({ format: 'uuid' }))
    })
  })
  
  .post('/scheduled-operations', async ({ body, db }) => {
    const scheduledOperations = await import('../db/schema').then(m => m.scheduledOperations);
    
    const [operation] = await db
      .insert(scheduledOperations)
      .values({
        outletId: body.outletId,
        operation: body.operation,
        scheduledTime: new Date(body.scheduledTime),
      })
      .returning();
    
    return operation;
  }, {
    body: t.Object({
      outletId: t.String({ format: 'uuid' }),
      operation: t.Union([
        t.Literal('on'),
        t.Literal('off'),
        t.Literal('reboot')
      ]),
      scheduledTime: t.String({ format: 'date-time' })
    })
  })
  
  .delete('/scheduled-operations/:id', async ({ params, db, set }) => {
    const scheduledOperations = await import('../db/schema').then(m => m.scheduledOperations);
    
    const [deleted] = await db
      .delete(scheduledOperations)
      .where(eq(scheduledOperations.id, params.id))
      .returning();
    
    if (!deleted) {
      set.status = 404;
      return { error: 'Scheduled operation not found' };
    }
    
    return { success: true };
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' })
    })
  });