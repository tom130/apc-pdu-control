import { Elysia, t } from 'elysia';
import { eq, and, desc } from 'drizzle-orm';
import { cronSchedules, scheduledOperations } from '../db/schema';
import { logger } from '../utils/logger';
import { Cron } from 'croner';

export const scheduleRoutes = new Elysia({ prefix: '/schedules' })

  // GET /api/schedules/outlet/:outletId — list all schedules for an outlet
  .get('/outlet/:outletId', async ({ params, db }) => {
    const cronItems = await db
      .select()
      .from(cronSchedules)
      .where(eq(cronSchedules.outletId, params.outletId))
      .orderBy(desc(cronSchedules.createdAt));

    const oneTimeItems = await db
      .select()
      .from(scheduledOperations)
      .where(and(
        eq(scheduledOperations.outletId, params.outletId),
        eq(scheduledOperations.executed, false)
      ))
      .orderBy(scheduledOperations.scheduledTime);

    return { cron: cronItems, oneTime: oneTimeItems };
  }, {
    params: t.Object({
      outletId: t.String({ format: 'uuid' }),
    }),
  })

  // POST /api/schedules/cron — create a cron schedule
  .post('/cron', async ({ body, db, set }) => {
    try {
      const job = new Cron(body.cronExpression);
      const nextRun = job.nextRun();

      const [schedule] = await db.insert(cronSchedules).values({
        outletId: body.outletId,
        name: body.name,
        cronExpression: body.cronExpression,
        operation: body.operation,
        nextRunAt: nextRun,
      }).returning();

      return schedule;
    } catch (error: any) {
      set.status = 400;
      return { error: 'Invalid cron expression', message: error.message };
    }
  }, {
    body: t.Object({
      outletId: t.String({ format: 'uuid' }),
      name: t.String({ minLength: 1, maxLength: 100 }),
      cronExpression: t.String({ minLength: 1 }),
      operation: t.Union([t.Literal('on'), t.Literal('off'), t.Literal('reboot')]),
    }),
  })

  // PUT /api/schedules/cron/:id — update a cron schedule
  .put('/cron/:id', async ({ params, body, db, set }) => {
    let nextRun: Date | null = null;
    if (body.cronExpression) {
      try {
        const job = new Cron(body.cronExpression);
        nextRun = job.nextRun();
      } catch (error: any) {
        set.status = 400;
        return { error: 'Invalid cron expression', message: error.message };
      }
    }

    const updates: any = { ...body, updatedAt: new Date() };
    if (nextRun) updates.nextRunAt = nextRun;

    const [updated] = await db
      .update(cronSchedules)
      .set(updates)
      .where(eq(cronSchedules.id, params.id))
      .returning();

    if (!updated) {
      set.status = 404;
      return { error: 'Schedule not found' };
    }

    return updated;
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
    body: t.Object({
      name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      cronExpression: t.Optional(t.String({ minLength: 1 })),
      operation: t.Optional(t.Union([t.Literal('on'), t.Literal('off'), t.Literal('reboot')])),
      isActive: t.Optional(t.Boolean()),
    }),
  })

  // DELETE /api/schedules/cron/:id
  .delete('/cron/:id', async ({ params, db, set }) => {
    const [deleted] = await db
      .delete(cronSchedules)
      .where(eq(cronSchedules.id, params.id))
      .returning();

    if (!deleted) {
      set.status = 404;
      return { error: 'Schedule not found' };
    }

    return { success: true };
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
  })

  // POST /api/schedules/one-time — create a one-time schedule
  .post('/one-time', async ({ body, db, set }) => {
    const scheduledTime = new Date(body.scheduledTime);
    if (scheduledTime <= new Date()) {
      set.status = 400;
      return { error: 'Scheduled time must be in the future' };
    }

    const [schedule] = await db.insert(scheduledOperations).values({
      outletId: body.outletId,
      operation: body.operation,
      scheduledTime,
    }).returning();

    return schedule;
  }, {
    body: t.Object({
      outletId: t.String({ format: 'uuid' }),
      operation: t.Union([t.Literal('on'), t.Literal('off'), t.Literal('reboot')]),
      scheduledTime: t.String(),
    }),
  })

  // DELETE /api/schedules/one-time/:id
  .delete('/one-time/:id', async ({ params, db, set }) => {
    const [deleted] = await db
      .delete(scheduledOperations)
      .where(eq(scheduledOperations.id, params.id))
      .returning();

    if (!deleted) {
      set.status = 404;
      return { error: 'Schedule not found' };
    }

    return { success: true };
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
  });
