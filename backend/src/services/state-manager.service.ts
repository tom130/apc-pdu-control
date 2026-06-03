import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { PDU, outlets, outletStateHistory, pduEvents } from '../db/schema';
import { SNMPService } from './snmp.service';
import { PrometheusService } from './prometheus.service';
import { ChangeType } from '../utils/constants';
import { deriveSnapshot } from '../utils/snapshot';
import { shouldRestore } from './restore-predicate';
import { withPduLock } from './pdu-lock';
import { logger } from '../utils/logger';
import { WebSocketService } from './websocket.service';

interface UpdateOutletStatesOptions {
  captureSnapshot?: boolean;
}

export class StateManager {
  private wsService: WebSocketService | null = null;
  private prometheusService: PrometheusService | null = null;

  constructor(
    private db: PostgresJsDatabase<any>,
    private snmpService: SNMPService
  ) {}

  private getPrometheusService(): PrometheusService {
    if (!this.prometheusService) {
      this.prometheusService = PrometheusService.getInstance();
    }
    return this.prometheusService;
  }

  setWebSocketService(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  async updateOutletStates(pdu: PDU, states: any[], options: UpdateOutletStatesOptions = {}): Promise<void> {
    const captureSnapshot = options.captureSnapshot ?? true;

    for (const state of states) {
      const outletNumber = state.outletNumber;
      const newState = state.state;
      const snapshotState = deriveSnapshot(newState);

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
        const updates: Record<string, any> = {};
        const stateChanged = outlet.actualState !== newState;

        if (stateChanged) {
          const previousState = outlet.actualState;
          updates.actualState = newState;
          updates.lastStateChange = new Date();

          this.getPrometheusService().recordStateChange(
            pdu,
            outlet,
            'auto_recovery',
            previousState || 'unknown',
            newState
          );
        }

        if (captureSnapshot && outlet.desiredState !== snapshotState) {
          updates.desiredState = snapshotState;
        }

        if (Object.keys(updates).length > 0) {
          await this.db
            .update(outlets)
            .set({
              ...updates,
              updatedAt: new Date(),
            })
            .where(eq(outlets.id, outlet.id));
        }
      } else {
        await this.db.insert(outlets).values({
          pduId: pdu.id,
          outletNumber,
          name: state.name || `Outlet ${outletNumber}`,
          displayOrder: outletNumber,
          actualState: newState,
          desiredState: snapshotState,
          lastStateChange: new Date(),
        });
      }
    }
  }

  async restoreFromPowerLoss(pdu: PDU): Promise<{ recovered: number; failed: number }> {
    logger.info({ pdu: pdu.name }, 'Starting power-loss restore');

    let recovered = 0;
    let failed = 0;

    try {
      const pduOutlets = await this.db
        .select()
        .from(outlets)
        .where(eq(outlets.pduId, pdu.id));

      const outletsToRestore = pduOutlets
        .filter(shouldRestore)
        .sort((a, b) => {
          const criticalOrder = Number(b.isCritical === true) - Number(a.isCritical === true);
          return criticalOrder || a.outletNumber - b.outletNumber;
        });

      for (const outlet of outletsToRestore) {
        const snapshotState = outlet.desiredState as 'on' | 'off';
        const previousState = outlet.actualState;

        try {
          await withPduLock(pdu.id, async () => {
            await this.snmpService.setOutletPower(pdu, outlet.outletNumber, snapshotState);

            await this.db
              .update(outlets)
              .set({
                actualState: snapshotState,
                lastStateChange: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(outlets.id, outlet.id));
          });

          await this.logStateChange(
            outlet.id,
            previousState,
            snapshotState,
            'pdu_reboot',
            'system'
          );

          this.getPrometheusService().recordStateChange(
            pdu,
            outlet,
            'pdu_reboot',
            previousState || 'unknown',
            snapshotState
          );

          if (this.wsService) {
            this.wsService.broadcast('outlet:state-changed', {
              pduId: pdu.id,
              outletId: outlet.id,
              outletNumber: outlet.outletNumber,
              newState: snapshotState,
            }, `pdu:${pdu.id}`);
          }

          recovered++;
          await Bun.sleep(outlet.isCritical ? 2000 : 1000);
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error({ error: errorMessage, outlet: outlet.outletNumber }, 'Failed to restore outlet after power loss');

          await this.logStateChange(
            outlet.id,
            previousState,
            snapshotState,
            'pdu_reboot',
            'system',
            false,
            errorMessage
          );
        }
      }

      await this.db.insert(pduEvents).values({
        pduId: pdu.id,
        eventType: 'recovery_complete',
        description: `Power-loss restore complete: ${recovered} outlets restored, ${failed} failed`,
        metadata: { recovered, failed },
      });

      logger.info({ pdu: pdu.name, recovered, failed }, 'Power-loss restore complete');
    } catch (error) {
      logger.error({ error, pdu: pdu.name }, 'Power-loss restore failed');
    }

    return { recovered, failed };
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
}
