import { eq, and, lte } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { pdus, outlets, powerMetrics, pduEvents, outletStateHistory, cronSchedules, scheduledOperations } from '../db/schema';
import { Cron } from 'croner';
import { SNMPService } from './snmp.service';
import { StateManager } from './state-manager.service';
import { WebSocketService } from './websocket.service';
import { PrometheusService } from './prometheus.service';
import { reachabilityEdge } from './reachability';
import { createRestoreGuard } from './restore-guard';
import { withPduLock } from './pdu-lock';
import { claimScheduledOperation } from './schedule-claim';
import { deriveSnapshot } from '../utils/snapshot';
import { INTERVALS } from '../utils/constants';
import { logger } from '../utils/logger';

export class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];
  private wsService: WebSocketService;
  private prometheusService: PrometheusService | null = null;
  private isRunning = false;
  private isCheckingSchedules = false;
  private reachable = new Map<string, boolean>();
  private restoreGuard = createRestoreGuard();

  constructor(
    private db: PostgresJsDatabase<any>,
    private snmpService: SNMPService,
    private stateManager: StateManager
  ) {
    this.wsService = WebSocketService.getInstance();
    this.stateManager.setWebSocketService(this.wsService);
  }
  
  private getPrometheusService(): PrometheusService {
    if (!this.prometheusService) {
      this.prometheusService = PrometheusService.getInstance();
    }
    return this.prometheusService;
  }

  start() {
    if (this.isRunning) {
      logger.warn('Scheduler service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting scheduler service');

    // Poll PDUs every 30 seconds
    const pollInterval = setInterval(() => {
      this.pollAllPDUs().catch(error => {
        logger.error({ error }, 'Failed to poll PDUs');
      });
    }, INTERVALS.POLL);
    this.intervals.push(pollInterval);

    // Collect metrics every 5 minutes
    const metricsInterval = setInterval(() => {
      this.collectMetrics().catch(error => {
        logger.error({ error }, 'Failed to collect metrics');
      });
    }, INTERVALS.METRICS);
    this.intervals.push(metricsInterval);

    // Check scheduled operations every minute
    const scheduleCheckInterval = setInterval(() => {
      this.checkScheduledOperations().catch(error => {
        logger.error({ error }, 'Failed to check scheduled operations');
      });
    }, INTERVALS.SCHEDULE_CHECK);
    this.intervals.push(scheduleCheckInterval);

    // Run initial poll
    this.pollAllPDUs().catch(error => {
      logger.error({ error }, 'Initial poll failed');
    });
  }

  stop() {
    logger.info('Stopping scheduler service');
    this.isRunning = false;
    
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
  }

  private async pollAllPDUs() {
    const activePDUs = await this.db
      .select()
      .from(pdus)
      .where(eq(pdus.isActive, true));

    logger.debug({ count: activePDUs.length }, 'Polling active PDUs');

    await Promise.allSettled(
      activePDUs.map(pdu => this.pollPDU(pdu))
    );
  }

  private async pollPDU(pdu: any) {
    const pollTimer = this.getPrometheusService().startPollTimer(pdu);
    
    try {
      await this.snmpService.probeReachable(pdu);

      // Get outlet states from SNMP
      const states = await this.snmpService.getOutletStates(pdu);
      
      // Update Prometheus metrics
      this.getPrometheusService().updateOutletStates(pdu, states);
      this.getPrometheusService().updatePDUStatus(pdu, 'online');

      const previousReachable = this.getPreviousReachable(pdu);
      const edge = reachabilityEdge(previousReachable, true);
      this.reachable.set(pdu.id, true);
      const captureSnapshot = edge === 'none' && previousReachable === true && !this.isRestoreInProgress(pdu.id);
      
      // Update database
      await this.stateManager.updateOutletStates(pdu, states, { captureSnapshot });
      
      // Update last seen timestamp
      const lastSeen = new Date();
      await this.db
        .update(pdus)
        .set({ lastSeen })
        .where(eq(pdus.id, pdu.id));

      if (edge === 'restored') {
        await this.db.insert(pduEvents).values({
          pduId: pdu.id,
          eventType: 'connection_restored',
          description: 'Connection restored after offline period',
        });

        const result = await this.restoreGuard.run(pdu.id, () => this.stateManager.restoreFromPowerLoss(pdu));
        if (!result.started) {
          logger.warn({ pdu: pdu.name }, 'Power-loss restore already in progress');
        }
      }
      
      // Emit WebSocket update
      this.wsService.broadcast('pdu:status-update', {
        pduId: pdu.id,
        status: 'online',
        outletStates: states,
        lastSeen: lastSeen.toISOString(),
      }, `pdu:${pdu.id}`);

    } catch (error: any) {
      logger.error({ error: error.message, pdu: pdu.name }, 'Failed to poll PDU');
      const previousReachable = this.getPreviousReachable(pdu);
      const edge = reachabilityEdge(previousReachable, false);
      this.reachable.set(pdu.id, false);
      
      // Update Prometheus metrics
      this.getPrometheusService().updatePDUStatus(pdu, 'offline');
      this.getPrometheusService().recordPollError(pdu, error.name || 'unknown');
      this.getPrometheusService().recordError(pdu, 'connection_lost', 'poll');
      
      if (edge === 'lost') {
        await this.db.insert(pduEvents).values({
          pduId: pdu.id,
          eventType: 'connection_lost',
          description: `Connection lost: ${error.message}`,
        });
      }

      // Emit offline status
      this.wsService.broadcast('pdu:status-update', {
        pduId: pdu.id,
        status: 'offline',
        error: error.message,
      }, `pdu:${pdu.id}`);
    } finally {
      pollTimer();
    }
  }

  private getPreviousReachable(pdu: any): boolean | undefined {
    if (this.reachable.has(pdu.id)) {
      return this.reachable.get(pdu.id);
    }

    if (!pdu.lastSeen) {
      return undefined;
    }

    const lastSeen = pdu.lastSeen instanceof Date ? pdu.lastSeen : new Date(pdu.lastSeen);
    const lastSeenTime = lastSeen.getTime();
    if (!Number.isFinite(lastSeenTime)) {
      return undefined;
    }

    const previousReachable = Date.now() - lastSeenTime <= INTERVALS.POLL * 3;
    this.reachable.set(pdu.id, previousReachable);
    return previousReachable;
  }

  private isRestoreInProgress(pduId: string): boolean {
    return this.restoreGuard.isRunning(pduId);
  }

  private async checkScheduledOperations() {
    if (this.isCheckingSchedules) {
      logger.debug('Schedule check already in progress, skipping');
      return;
    }

    this.isCheckingSchedules = true;
    try {
      await this.executeOneTimeSchedules();
      await this.executeCronSchedules();
    } finally {
      this.isCheckingSchedules = false;
    }
  }

  private async executeOneTimeSchedules() {
    const now = new Date();
    const missedThresholdMs = INTERVALS.SCHEDULE_CHECK * 2;
    const dueOperations = await this.db
      .select({
        operation: scheduledOperations,
        outlet: outlets,
      })
      .from(scheduledOperations)
      .innerJoin(outlets, eq(scheduledOperations.outletId, outlets.id))
      .where(and(
        lte(scheduledOperations.scheduledTime, now),
        eq(scheduledOperations.executed, false)
      ));

    for (const { operation, outlet } of dueOperations) {
      const scheduledTime = operation.scheduledTime instanceof Date ? operation.scheduledTime : new Date(operation.scheduledTime);
      if (Number.isFinite(scheduledTime.getTime()) && now.getTime() - scheduledTime.getTime() > missedThresholdMs) {
        logger.warn({
          operationId: operation.id,
          scheduledTime,
          delayMs: now.getTime() - scheduledTime.getTime(),
        }, 'Executing missed one-time schedule');
      }

      const claimed = await claimScheduledOperation(this.db, operation.id, now);
      if (!claimed) {
        logger.debug({ operationId: operation.id }, 'Scheduled operation already claimed');
        continue;
      }

      await this.executeScheduledOperation(outlet, claimed.operation, 'one-time', operation.id);
    }
  }

  private async executeCronSchedules() {
    const now = new Date();
    const activeSchedules = await this.db
      .select({
        schedule: cronSchedules,
        outlet: outlets,
      })
      .from(cronSchedules)
      .innerJoin(outlets, eq(cronSchedules.outletId, outlets.id))
      .where(and(
        eq(cronSchedules.isActive, true),
        lte(cronSchedules.nextRunAt, now)
      ));

    for (const { schedule, outlet } of activeSchedules) {
      try {
        const cron = new Cron(schedule.cronExpression);
        const nextRun = cron.nextRun();
        const scheduledTime = schedule.nextRunAt instanceof Date ? schedule.nextRunAt : new Date(schedule.nextRunAt);
        const missedThresholdMs = INTERVALS.SCHEDULE_CHECK * 2;
        if (Number.isFinite(scheduledTime.getTime()) && now.getTime() - scheduledTime.getTime() > missedThresholdMs) {
          logger.warn({
            scheduleId: schedule.id,
            scheduledTime,
            delayMs: now.getTime() - scheduledTime.getTime(),
          }, 'Executing missed cron schedule');
        }

        await this.db
          .update(cronSchedules)
          .set({
            lastExecutedAt: now,
            nextRunAt: nextRun,
            updatedAt: now,
          })
          .where(eq(cronSchedules.id, schedule.id));

        await this.executeScheduledOperation(outlet, schedule.operation, 'cron', schedule.id);
      } catch (error: any) {
        logger.error({ error: error.message, scheduleId: schedule.id }, 'Failed to parse cron expression');
      }
    }
  }

  private async executeScheduledOperation(
    outlet: any,
    operation: string,
    scheduleType: 'one-time' | 'cron',
    scheduleId: string
  ) {
    const [pduRow] = await this.db
      .select()
      .from(pdus)
      .where(eq(pdus.id, outlet.pduId));

    if (!pduRow) {
      logger.error({ outletId: outlet.id }, 'PDU not found for scheduled operation');
      return;
    }

    const previousState = outlet.actualState;
    const snapshotState = deriveSnapshot(operation);

    try {
      await withPduLock(pduRow.id, async () => {
        await this.snmpService.setOutletPower(pduRow, outlet.outletNumber, operation as any);

        await this.db
          .update(outlets)
          .set({
            actualState: snapshotState,
            desiredState: snapshotState,
            lastStateChange: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(outlets.id, outlet.id));
      });

      await this.db.insert(outletStateHistory).values({
        outletId: outlet.id,
        previousState,
        newState: operation,
        changeType: 'scheduled',
        initiatedBy: 'scheduler',
        success: true,
      });

      this.wsService.broadcast('outlet:scheduled-operation', {
        outletId: outlet.id,
        pduId: outlet.pduId,
        operation,
        scheduleType,
        scheduleId,
        success: true,
        timestamp: new Date().toISOString(),
      }, `pdu:${outlet.pduId}`);

      logger.info({
        outlet: outlet.name || `#${outlet.outletNumber}`,
        operation,
        scheduleType,
      }, 'Scheduled operation executed');

    } catch (error: any) {
      logger.error({ error: error.message, outletId: outlet.id, operation }, 'Scheduled operation failed');

      await this.db.insert(outletStateHistory).values({
        outletId: outlet.id,
        previousState,
        newState: operation,
        changeType: 'scheduled',
        initiatedBy: 'scheduler',
        success: false,
        errorMessage: error.message,
      });

      this.wsService.broadcast('outlet:scheduled-operation', {
        outletId: outlet.id,
        pduId: outlet.pduId,
        operation,
        scheduleType,
        scheduleId,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }, `pdu:${outlet.pduId}`);
    }
  }

  private async collectMetrics() {
    const activePDUs = await this.db
      .select()
      .from(pdus)
      .where(eq(pdus.isActive, true));

    logger.debug({ count: activePDUs.length }, 'Collecting metrics for active PDUs');

    for (const pdu of activePDUs) {
      try {
        const metrics = await this.snmpService.getPowerMetrics(pdu);
        
        // Skip if PDU doesn't support power monitoring
        if (!metrics) {
          logger.debug({ pdu: pdu.name }, 'PDU does not support power monitoring, skipping metrics collection');
          continue;
        }
        
        // Update Prometheus metrics
        this.getPrometheusService().updatePowerMetrics(pdu, metrics);
        
        // Store metrics in database
        await this.db.insert(powerMetrics).values({
          pduId: pdu.id,
          totalPowerDraw: metrics.totalPowerDraw.toString(),
          totalPowerWatts: metrics.totalPowerWatts,
          voltage: metrics.voltage,
          loadState: metrics.loadState,
        });

        // Emit metrics update
        this.wsService.broadcast('metrics:updated', {
          pduId: pdu.id,
          metrics,
          timestamp: new Date().toISOString(),
        }, `pdu:${pdu.id}`);

        // Check for overload
        if (metrics.loadState === 'overload' || metrics.loadState === 'near_overload') {
          logger.warn({
            pdu: pdu.name,
            loadState: metrics.loadState,
            powerDraw: metrics.totalPowerDraw,
            powerWatts: metrics.totalPowerWatts,
          }, 'PDU load warning');

          await this.db.insert(pduEvents).values({
            pduId: pdu.id,
            eventType: 'state_skew',
            description: `Load state: ${metrics.loadState} (${metrics.totalPowerDraw} A / ${metrics.totalPowerWatts} W)`,
            metadata: metrics,
          });
        }
      } catch (error) {
        logger.error({ error, pdu: pdu.name }, 'Failed to collect metrics');
        this.getPrometheusService().recordError(pdu, 'metrics_collection_failed', 'collectMetrics');
      }
    }
  }

}
