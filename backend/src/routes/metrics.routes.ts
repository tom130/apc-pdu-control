import { Elysia, t } from 'elysia';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { powerMetrics, pduEvents } from '../db/schema';

export const metricsRoutes = new Elysia({ prefix: '/pdus/:pduId' })
  .get('/metrics', async ({ params, query, db }) => {
    let metricsQuery = db
      .select()
      .from(powerMetrics)
      .where(eq(powerMetrics.pduId, params.pduId))
      .$dynamic();
    
    // Add date filters if provided
    const conditions = [eq(powerMetrics.pduId, params.pduId)];
    
    if (query.startDate) {
      conditions.push(gte(powerMetrics.timestamp, new Date(query.startDate)));
    }
    
    if (query.endDate) {
      conditions.push(lte(powerMetrics.timestamp, new Date(query.endDate)));
    }
    
    const metrics = await db
      .select()
      .from(powerMetrics)
      .where(and(...conditions))
      .orderBy(desc(powerMetrics.timestamp))
      .limit(query.limit || 100);
    
    return metrics;
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' })
    }),
    query: t.Object({
      startDate: t.Optional(t.String({ format: 'date-time' })),
      endDate: t.Optional(t.String({ format: 'date-time' })),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 1000 }))
    })
  })
  
  .get('/metrics/current', async ({ params, db, snmpService, set }) => {
    // Get PDU from database
    const pdus = await import('../db/schema').then(m => m.pdus);
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
      // Get current metrics from SNMP
      const metrics = await snmpService.getPowerMetrics(pdu);
      
      if (!metrics) {
        set.status = 404;
        return { error: 'PDU does not support power monitoring' };
      }
      
      // Store in database
      await db.insert(powerMetrics).values({
        pduId: params.pduId,
        totalPowerDraw: metrics.totalPowerDraw.toString(),
        totalPowerWatts: metrics.totalPowerWatts,
        voltage: metrics.voltage,
        loadState: metrics.loadState,
      });
      
      return {
        id: crypto.randomUUID(),
        pduId: params.pduId,
        totalPowerDraw: metrics.totalPowerDraw,
        totalPowerWatts: metrics.totalPowerWatts,
        voltage: metrics.voltage,
        loadState: metrics.loadState,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      set.status = 500;
      return {
        error: 'Failed to get power metrics',
        message: error.message
      };
    }
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' })
    })
  })
  
  .get('/events', async ({ params, query, db }) => {
    const events = await db
      .select()
      .from(pduEvents)
      .where(eq(pduEvents.pduId, params.pduId))
      .orderBy(desc(pduEvents.timestamp))
      .limit(query.limit || 100);
    
    return events;
  }, {
    params: t.Object({
      pduId: t.String({ format: 'uuid' })
    }),
    query: t.Object({
      limit: t.Optional(t.Number({ minimum: 1, maximum: 500 }))
    })
  });