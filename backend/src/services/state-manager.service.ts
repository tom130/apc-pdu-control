import { eq, and, ne, isNotNull, gte } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { PDU, Outlet, outlets, outletStateHistory, pduEvents } from '../db/schema';
import { SNMPService } from './snmp.service';
import { OutletState, ChangeType } from '../utils/constants';
import { logger } from '../utils/logger';
import { WebSocketService } from './websocket.service';

export class StateManager {
  private wsService: WebSocketService | null = null;

  constructor(
    private db: PostgresJsDatabase<any>,
    private snmpService: SNMPService
  ) {}

  setWebSocketService(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  async reconcileStates(pdu: PDU): Promise<{ reconciled: number; failed: number }> {
    logger.info({ pdu: pdu.name }, 'Starting state reconciliation');
    
    let reconciled = 0;
    let failed = 0;

    try {
      // Get outlets with state skew
      const skewedOutlets = await this.db
        .select()
        .from(outlets)
        .where(
          and(
            eq(outlets.pduId, pdu.id),
            isNotNull(outlets.desiredState),
            ne(outlets.desiredState, outlets.actualState)
          )
        );

      for (const outlet of skewedOutlets) {
        try {
          await this.applyDesiredState(pdu, outlet);
          reconciled++;
        } catch (error) {
          logger.error({ error, outlet: outlet.outletNumber }, 'Failed to reconcile outlet');
          failed++;
        }
      }

      logger.info({ pdu: pdu.name, reconciled, failed }, 'State reconciliation complete');
    } catch (error) {
      logger.error({ error, pdu: pdu.name }, 'State reconciliation failed');
    }

    return { reconciled, failed };
  }

  async applyDesiredState(pdu: PDU, outlet: Outlet): Promise<boolean> {
    if (!outlet.desiredState) return false;

    try {
      // Apply the state via SNMP
      await this.snmpService.setOutletPower(pdu, outlet.outletNumber, outlet.desiredState as OutletState);
      
      // Update the database
      await this.db
        .update(outlets)
        .set({
          actualState: outlet.desiredState,
          lastStateChange: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(outlets.id, outlet.id));

      // Log the state change
      await this.logStateChange(
        outlet.id,
        outlet.actualState,
        outlet.desiredState,
        'sync',
        'system'
      );

      // Emit WebSocket event
      if (this.wsService) {
        this.wsService.broadcast('outlet:state-changed', {
          pduId: pdu.id,
          outletId: outlet.id,
          outletNumber: outlet.outletNumber,
          newState: outlet.desiredState,
        });
      }

      return true;
    } catch (error) {
      logger.error({ error, outlet: outlet.outletNumber }, 'Failed to apply desired state');
      
      await this.logStateChange(
        outlet.id,
        outlet.actualState,
        outlet.desiredState,
        'sync',
        'system',
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      return false;
    }
  }

  async detectReboot(pdu: PDU): Promise<boolean> {
    try {
      // Check if many outlets changed state recently
      const recentChanges = await this.db
        .select()
        .from(outlets)
        .where(
          and(
            eq(outlets.pduId, pdu.id),
            gte(outlets.lastStateChange, new Date(Date.now() - 120000)) // Last 2 minutes
          )
        );

      const totalOutlets = await this.db
        .select()
        .from(outlets)
        .where(eq(outlets.pduId, pdu.id));

      // If more than 80% of outlets changed state recently, likely a reboot
      const rebootDetected = recentChanges.length > totalOutlets.length * 0.8;

      if (rebootDetected) {
        logger.warn({ pdu: pdu.name }, 'PDU reboot detected');
        
        // Log the event
        await this.db.insert(pduEvents).values({
          pduId: pdu.id,
          eventType: 'reboot',
          description: 'PDU reboot detected - multiple outlets changed state simultaneously',
          metadata: { affectedOutlets: recentChanges.length },
        });

        // Emit WebSocket event
        if (this.wsService) {
          this.wsService.broadcast('pdu:reboot-detected', {
            pduId: pdu.id,
            pduName: pdu.name,
          });
        }
      }

      return rebootDetected;
    } catch (error) {
      logger.error({ error, pdu: pdu.name }, 'Failed to detect reboot');
      return false;
    }
  }

  async recoverFromReboot(pdu: PDU): Promise<{ recovered: number; failed: number }> {
    logger.info({ pdu: pdu.name }, 'Starting reboot recovery');
    
    // Wait for PDU to stabilize
    await Bun.sleep(60000); // 60 seconds
    
    let recovered = 0;
    let failed = 0;

    try {
      // Get critical outlets first
      const criticalOutlets = await this.db
        .select()
        .from(outlets)
        .where(
          and(
            eq(outlets.pduId, pdu.id),
            eq(outlets.isCritical, true),
            isNotNull(outlets.desiredState),
            eq(outlets.autoRecovery, true)
          )
        );

      // Apply critical outlet states first
      for (const outlet of criticalOutlets) {
        try {
          await this.applyDesiredState(pdu, outlet);
          recovered++;
          await Bun.sleep(2000); // 2 second delay between critical outlets
        } catch (error) {
          logger.error({ error, outlet: outlet.outletNumber }, 'Failed to recover critical outlet');
          failed++;
        }
      }

      // Then handle non-critical outlets
      const nonCriticalOutlets = await this.db
        .select()
        .from(outlets)
        .where(
          and(
            eq(outlets.pduId, pdu.id),
            eq(outlets.isCritical, false),
            isNotNull(outlets.desiredState),
            eq(outlets.autoRecovery, true)
          )
        );

      for (const outlet of nonCriticalOutlets) {
        try {
          await this.applyDesiredState(pdu, outlet);
          recovered++;
          await Bun.sleep(1000); // 1 second delay between non-critical outlets
        } catch (error) {
          logger.error({ error, outlet: outlet.outletNumber }, 'Failed to recover outlet');
          failed++;
        }
      }

      logger.info({ pdu: pdu.name, recovered, failed }, 'Reboot recovery complete');
      
      // Log recovery event
      await this.db.insert(pduEvents).values({
        pduId: pdu.id,
        eventType: 'connection_restored',
        description: `Recovery complete: ${recovered} outlets recovered, ${failed} failed`,
        metadata: { recovered, failed },
      });

    } catch (error) {
      logger.error({ error, pdu: pdu.name }, 'Reboot recovery failed');
    }

    return { recovered, failed };
  }

  async updateOutletStates(pdu: PDU, states: any[]): Promise<void> {
    for (const state of states) {
      const outletNumber = state.outletNumber;
      const newState = state.state;

      // Get the outlet from database
      const [outlet] = await this.db
        .select()
        .from(outlets)
        .where(
          and(
            eq(outlets.pduId, pdu.id),
            eq(outlets.outletNumber, outletNumber)
          )
        )
        .limit(1);

      if (outlet) {
        // Check if state changed
        if (outlet.actualState !== newState) {
          // Update the state
          await this.db
            .update(outlets)
            .set({
              actualState: newState,
              lastStateChange: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(outlets.id, outlet.id));

          // Check for state skew
          if (outlet.desiredState && outlet.desiredState !== newState) {
            logger.warn({
              outlet: outletNumber,
              desired: outlet.desiredState,
              actual: newState,
            }, 'State skew detected');

            // Emit skew alert
            if (this.wsService) {
              this.wsService.broadcast('outlet:state-skew', {
                pduId: pdu.id,
                outletId: outlet.id,
                outletNumber: outlet.outletNumber,
                desiredState: outlet.desiredState,
                actualState: newState,
              });
            }
          }
        }
      } else {
        // Create new outlet entry
        await this.db.insert(outlets).values({
          pduId: pdu.id,
          outletNumber,
          name: state.name || `Outlet ${outletNumber}`,
          actualState: newState,
          lastStateChange: new Date(),
        });
      }
    }
  }

  private async logStateChange(
    outletId: string,
    previousState: string | null,
    newState: string | null,
    changeType: ChangeType,
    initiatedBy: string,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await this.db.insert(outletStateHistory).values({
      outletId,
      previousState,
      newState,
      changeType,
      initiatedBy,
      success,
      errorMessage,
    });
  }

  async calculateStateSkew(pduId: string): Promise<number> {
    const allOutlets = await this.db
      .select()
      .from(outlets)
      .where(eq(outlets.pduId, pduId));

    const skewedOutlets = allOutlets.filter(
      outlet => outlet.desiredState && outlet.desiredState !== outlet.actualState
    );

    return allOutlets.length > 0 ? (skewedOutlets.length / allOutlets.length) * 100 : 0;
  }
}