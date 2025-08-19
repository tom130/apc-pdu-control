import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { pdus, outlets, powerMetrics, pduEvents } from '../db/schema';
import { SNMPService } from './snmp.service';
import { StateManager } from './state-manager.service';
import { WebSocketService } from './websocket.service';
import { INTERVALS } from '../utils/constants';
import { logger } from '../utils/logger';

export class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];
  private wsService: WebSocketService;
  private isRunning = false;

  constructor(
    private db: PostgresJsDatabase<any>,
    private snmpService: SNMPService,
    private stateManager: StateManager
  ) {
    this.wsService = WebSocketService.getInstance();
    this.stateManager.setWebSocketService(this.wsService);
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

    // Reconcile states every minute
    const reconcileInterval = setInterval(() => {
      this.reconcileAllStates().catch(error => {
        logger.error({ error }, 'Failed to reconcile states');
      });
    }, INTERVALS.RECONCILE);
    this.intervals.push(reconcileInterval);

    // Collect metrics every 5 minutes
    const metricsInterval = setInterval(() => {
      this.collectMetrics().catch(error => {
        logger.error({ error }, 'Failed to collect metrics');
      });
    }, INTERVALS.METRICS);
    this.intervals.push(metricsInterval);

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
    try {
      // Get outlet states from SNMP
      const states = await this.snmpService.getOutletStates(pdu);
      
      // Update database
      await this.stateManager.updateOutletStates(pdu, states);
      
      // Update last seen timestamp
      await this.db
        .update(pdus)
        .set({ lastSeen: new Date() })
        .where(eq(pdus.id, pdu.id));

      // Check for reboot
      const rebootDetected = await this.stateManager.detectReboot(pdu);
      if (rebootDetected) {
        // Schedule recovery
        setTimeout(async () => {
          await this.stateManager.recoverFromReboot(pdu);
        }, 5000);
      }

      // Calculate state skew
      const skewPercentage = await this.stateManager.calculateStateSkew(pdu.id);
      
      // Emit WebSocket update
      this.wsService.broadcast('pdu:status-update', {
        pduId: pdu.id,
        status: 'online',
        outletStates: states,
        stateSkew: skewPercentage,
        lastSeen: new Date().toISOString(),
      }, `pdu:${pdu.id}`);

    } catch (error: any) {
      logger.error({ error: error.message, pdu: pdu.name }, 'Failed to poll PDU');
      
      // Mark PDU as offline
      await this.db.insert(pduEvents).values({
        pduId: pdu.id,
        eventType: 'connection_lost',
        description: `Connection lost: ${error.message}`,
      });

      // Emit offline status
      this.wsService.broadcast('pdu:status-update', {
        pduId: pdu.id,
        status: 'offline',
        error: error.message,
      }, `pdu:${pdu.id}`);
    }
  }

  private async reconcileAllStates() {
    const activePDUs = await this.db
      .select()
      .from(pdus)
      .where(eq(pdus.isActive, true));

    logger.debug({ count: activePDUs.length }, 'Reconciling states for active PDUs');

    for (const pdu of activePDUs) {
      try {
        const result = await this.stateManager.reconcileStates(pdu);
        
        if (result.reconciled > 0 || result.failed > 0) {
          logger.info({
            pdu: pdu.name,
            reconciled: result.reconciled,
            failed: result.failed,
          }, 'State reconciliation completed');
        }
      } catch (error) {
        logger.error({ error, pdu: pdu.name }, 'State reconciliation failed');
      }
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
      }
    }
  }
}