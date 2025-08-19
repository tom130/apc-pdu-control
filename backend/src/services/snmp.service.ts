import * as snmp from 'net-snmp';
import { PDU } from '../db/schema';
import { SNMP_OIDS, SNMP_COMMANDS, SNMP_STATE_MAP, OutletState, LoadState } from '../utils/constants';
import { decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';
import { PrometheusService } from './prometheus.service';

interface OutletStatus {
  outletNumber: number;
  name: string;
  state: OutletState;
}

interface PowerMetrics {
  totalPowerDraw: number;  // in Amperes (tenths of amps from SNMP)
  totalPowerWatts: number; // calculated: Amps * 230V (EU standard)
  loadState: LoadState;
  voltage: number;         // EU standard voltage
}

export class SNMPService {
  private sessions = new Map<string, any>();
  private timeout: number;
  private retries: number;
  private prometheusService: PrometheusService | null = null;

  constructor() {
    this.timeout = parseInt(process.env.SNMP_TIMEOUT || '5000');
    this.retries = parseInt(process.env.SNMP_RETRIES || '3');
  }
  
  private getPrometheusService(): PrometheusService {
    if (!this.prometheusService) {
      this.prometheusService = PrometheusService.getInstance();
    }
    return this.prometheusService;
  }

  private createSession(pdu: PDU, forRead: boolean = false): any {
    if (!pdu.snmpUser && !forRead) {
      throw new Error('SNMP user/community not configured for PDU');
    }

    const options = {
      port: 161,
      retries: this.retries,
      timeout: this.timeout,
      idBitsSize: 32,
    };

    // Handle different SNMP versions
    const version = pdu.snmpVersion || 'v3';
    
    if (version === 'v1' || version === 'v2c') {
      // For SNMPv1/v2c, use 'public' for read operations, configured community for write
      // Many APC PDUs use 'public' for read and 'private' for write
      const community = forRead ? 'public' : (pdu.snmpUser || 'public');
      options.version = version === 'v1' ? snmp.Version1 : snmp.Version2c;
      return snmp.createSession(pdu.ipAddress, community, options);
    } else {
      // SNMPv3 handling
      options.version = snmp.Version3;
      
      // Determine security level (default to noAuthNoPriv for APC PDUs)
      const securityLevel = pdu.snmpSecurityLevel || 'noAuthNoPriv';
      
      // Build user object based on security level
      const user: any = {
        name: pdu.snmpUser,
        level: snmp.SecurityLevel[securityLevel as keyof typeof snmp.SecurityLevel] || snmp.SecurityLevel.noAuthNoPriv,
      };

      // Add auth settings if required by security level
      if (securityLevel === 'authNoPriv' || securityLevel === 'authPriv') {
        if (!pdu.snmpAuthPassphrase) {
          throw new Error('Authentication passphrase required for security level: ' + securityLevel);
        }
        user.authProtocol = snmp.AuthProtocols[(pdu.snmpAuthProtocol || 'sha') as keyof typeof snmp.AuthProtocols] || snmp.AuthProtocols.sha;
        user.authKey = decrypt(pdu.snmpAuthPassphrase);
      }

      // Add privacy settings if required by security level
      if (securityLevel === 'authPriv') {
        if (!pdu.snmpPrivPassphrase) {
          throw new Error('Privacy passphrase required for security level: authPriv');
        }
        user.privProtocol = snmp.PrivProtocols[(pdu.snmpPrivProtocol || 'aes') as keyof typeof snmp.PrivProtocols] || snmp.PrivProtocols.aes;
        user.privKey = decrypt(pdu.snmpPrivPassphrase);
      }

      return snmp.createV3Session(pdu.ipAddress, user, options);
    }
  }

  private getOrCreateSession(pdu: PDU, forRead: boolean = false): any {
    const sessionKey = forRead ? `${pdu.id}-read` : pdu.id;
    
    if (!this.sessions.has(sessionKey)) {
      const session = this.createSession(pdu, forRead);
      this.sessions.set(sessionKey, session);
    }
    
    return this.sessions.get(sessionKey);
  }

  async testConnection(pdu: PDU): Promise<{ success: boolean; message: string }> {
    try {
      const session = this.createSession(pdu, true); // Use read session for testing
      
      return new Promise((resolve) => {
        session.get([SNMP_OIDS.rPDUIdentName], (error: any, varbinds: any) => {
          session.close();
          
          if (error) {
            logger.error({ error: error.toString(), pdu: pdu.name }, 'SNMP connection test failed');
            resolve({
              success: false,
              message: `Connection failed: ${error.toString()}`,
            });
          } else {
            resolve({
              success: true,
              message: `Connected successfully. PDU Name: ${varbinds[0].value}`,
            });
          }
        });
      });
    } catch (error: any) {
      return {
        success: false,
        message: `Configuration error: ${error.message}`,
      };
    }
  }

  async getPDUInfo(pdu: PDU): Promise<any> {
    const session = this.getOrCreateSession(pdu, true); // Use read session
    const oids = [
      SNMP_OIDS.rPDUIdentName,
      SNMP_OIDS.rPDUIdentModelNumber,
      SNMP_OIDS.rPDUIdentSerialNumber,
      SNMP_OIDS.rPDUIdentFirmwareRev,
    ];

    return new Promise((resolve, reject) => {
      session.get(oids, (error: any, varbinds: any) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            name: varbinds[0]?.value?.toString(),
            model: varbinds[1]?.value?.toString(),
            serialNumber: varbinds[2]?.value?.toString(),
            firmware: varbinds[3]?.value?.toString(),
          });
        }
      });
    });
  }

  async getOutletStates(pdu: PDU): Promise<OutletStatus[]> {
    const timer = this.getPrometheusService().startSNMPTimer(pdu, 'getOutletStates');
    const session = this.getOrCreateSession(pdu, true); // Use read session
    const outlets: OutletStatus[] = [];

    try {
      // Try newer OIDs first (2G PDUs)
      let names = await this.walkOID(session, SNMP_OIDS.rPDUOutletStatusOutletName);
      let states = await this.walkOID(session, SNMP_OIDS.rPDUOutletStatusOutletState);
      
      // If no results, try older OIDs (1G PDUs like AP7951)
      if (names.length === 0 || states.length === 0) {
        logger.debug({ pdu: pdu.name }, 'Trying older OIDs for 1G PDU');
        names = await this.walkOID(session, SNMP_OIDS.rPDUOutletStatusOutletNameOld);
        states = await this.walkOID(session, SNMP_OIDS.rPDUOutletStatusOutletStateOld);
      }

      // Combine the data
      for (let i = 0; i < Math.max(names.length, states.length); i++) {
        const outletNumber = i + 1;
        const name = names[i]?.value?.toString() || `Outlet ${outletNumber}`;
        const stateValue = states[i]?.value;
        const state = SNMP_STATE_MAP.OUTLET[stateValue as keyof typeof SNMP_STATE_MAP.OUTLET] || 'off';

        outlets.push({
          outletNumber,
          name,
          state: state as OutletState,
        });
      }
    } catch (error: any) {
      logger.error({ error: error.message || error.toString(), stack: error.stack, pdu: pdu.name }, 'Failed to get outlet states');
      this.getPrometheusService().recordError(pdu, 'snmp_error', 'getOutletStates');
      throw error;
    } finally {
      timer();
    }

    return outlets;
  }

  async setOutletPower(pdu: PDU, outletNumber: number, state: OutletState): Promise<boolean> {
    const timer = this.getPrometheusService().startSNMPTimer(pdu, 'setOutletPower');
    const session = this.getOrCreateSession(pdu);
    const value = SNMP_COMMANDS.OUTLET[state.toUpperCase() as keyof typeof SNMP_COMMANDS.OUTLET];
    
    // Determine which OID to use based on PDU version
    // Try newer OID first, fall back to older if it fails
    let oid = `${SNMP_OIDS.rPDUOutletControlOutletCommand}${outletNumber}`;
    
    return new Promise((resolve, reject) => {
      const varbind = {
        oid,
        type: snmp.ObjectType.Integer,
        value,
      };

      session.set([varbind], (error: any) => {
        if (error && error.message?.includes('NoSuchName')) {
          // Try older OID format for 1G PDUs
          oid = `${SNMP_OIDS.rPDUOutletControlOutletCommandOld}${outletNumber}`;
          const varbindOld = { ...varbind, oid };
          
          session.set([varbindOld], (error2: any) => {
            if (error2) {
              logger.error({ error: error2.toString(), pdu: pdu.name, outlet: outletNumber }, 'Failed to set outlet power');
              this.getPrometheusService().recordError(pdu, 'snmp_error', 'setOutletPower');
              timer();
              reject(error2);
            } else {
              logger.info({ pdu: pdu.name, outlet: outletNumber, state }, 'Outlet power state changed (using old OID)');
              timer();
              resolve(true);
            }
          });
        } else if (error) {
          logger.error({ error: error.toString(), pdu: pdu.name, outlet: outletNumber }, 'Failed to set outlet power');
          this.getPrometheusService().recordError(pdu, 'snmp_error', 'setOutletPower');
          timer();
          reject(error);
        } else {
          logger.info({ pdu: pdu.name, outlet: outletNumber, state }, 'Outlet power state changed');
          timer();
          resolve(true);
        }
      });
    });
  }

  async setAllOutlets(pdu: PDU, state: 'on' | 'off' | 'reboot'): Promise<boolean> {
    const session = this.getOrCreateSession(pdu);
    const commandMap = {
      on: SNMP_COMMANDS.DEVICE.ON_ALL,
      off: SNMP_COMMANDS.DEVICE.OFF_ALL,
      reboot: SNMP_COMMANDS.DEVICE.REBOOT_ALL,
    };
    const value = commandMap[state];

    return new Promise((resolve, reject) => {
      const varbind = {
        oid: SNMP_OIDS.rPDUOutletDevCommand,
        type: snmp.ObjectType.Integer,
        value,
      };

      session.set([varbind], (error: any) => {
        if (error) {
          logger.error({ error: error.toString(), pdu: pdu.name }, 'Failed to set all outlets');
          reject(error);
        } else {
          logger.info({ pdu: pdu.name, state }, 'All outlets state changed');
          resolve(true);
        }
      });
    });
  }

  async getPowerMetrics(pdu: PDU): Promise<PowerMetrics | null> {
    const timer = this.getPrometheusService().startSNMPTimer(pdu, 'getPowerMetrics');
    const session = this.getOrCreateSession(pdu, true); // Use read session
    
    // Try indexed OIDs first (works on AP7951 and many 2G PDUs)
    const oidsWithIndex = [
      SNMP_OIDS.rPDULoadStatusLoadIndexed,      // Current with .1 index
      SNMP_OIDS.rPDULoadStatusLoadStateIndexed, // Load state with .1 index
    ];
    
    // Fallback to non-indexed OIDs
    const oidsNoIndex = [
      SNMP_OIDS.rPDULoadStatusLoad,
      SNMP_OIDS.rPDULoadStatusLoadState,
    ];

    return new Promise((resolve) => {
      // First try with indexed OIDs
      session.get(oidsWithIndex, (error: any, varbinds: any) => {
        if (!error && varbinds[0]?.value) {
          // Success with indexed OIDs
          const powerDrawTenths = varbinds[0]?.value || 0;
          const powerDrawAmps = powerDrawTenths / 10; // Convert to actual amps
          const loadStateValue = varbinds[1]?.value || 1;
          const loadState = SNMP_STATE_MAP.LOAD[loadStateValue as keyof typeof SNMP_STATE_MAP.LOAD] || 'normal';
          
          // EU standard voltage
          const voltage = 230;
          const powerWatts = Math.round(powerDrawAmps * voltage);
          
          logger.debug({ pdu: pdu.name, amps: powerDrawAmps, watts: powerWatts }, 'Power metrics retrieved (indexed OIDs)');

          timer();
          resolve({
            totalPowerDraw: powerDrawAmps,
            totalPowerWatts: powerWatts,
            loadState: loadState as LoadState,
            voltage: voltage,
          });
        } else {
          // Try without index
          session.get(oidsNoIndex, (error2: any, varbinds2: any) => {
            if (!error2 && varbinds2[0]?.value) {
              // Success with non-indexed OIDs
              const powerDrawTenths = varbinds2[0]?.value || 0;
              const powerDrawAmps = powerDrawTenths / 10;
              const loadStateValue = varbinds2[1]?.value || 1;
              const loadState = SNMP_STATE_MAP.LOAD[loadStateValue as keyof typeof SNMP_STATE_MAP.LOAD] || 'normal';
              
              const voltage = 230;
              const powerWatts = Math.round(powerDrawAmps * voltage);
              
              logger.debug({ pdu: pdu.name, amps: powerDrawAmps, watts: powerWatts }, 'Power metrics retrieved (non-indexed OIDs)');

              timer();
              resolve({
                totalPowerDraw: powerDrawAmps,
                totalPowerWatts: powerWatts,
                loadState: loadState as LoadState,
                voltage: voltage,
              });
            } else {
              // Power monitoring not supported or not available
              logger.debug({ 
                error1: error?.message, 
                error2: error2?.message, 
                pdu: pdu.name 
              }, 'Power metrics not available');
              timer();
              resolve(null);
            }
          });
        }
      });
    });
  }

  private walkOID(session: any, oid: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      
      session.walk(oid, 20, // maxRepetitions for SNMPv2c/v3
        (varbinds: any) => {
          // Feed callback - called for each varbind
          if (varbinds && varbinds.length > 0) {
            for (let i = 0; i < varbinds.length; i++) {
              if (varbinds[i].oid.indexOf(oid) === 0) {
                results.push(varbinds[i]);
              }
            }
          }
        },
        (error: any) => {
          // Done callback
          if (error) {
            logger.debug({ error: error.message, oid }, 'Walk completed with error');
            // Don't reject on walk error, just return what we have
            resolve(results);
          } else {
            resolve(results);
          }
        }
      );
    });
  }

  closeSession(pduId: string): void {
    const session = this.sessions.get(pduId);
    if (session) {
      session.close();
      this.sessions.delete(pduId);
    }
  }

  closeAllSessions(): void {
    for (const [id, session] of this.sessions) {
      session.close();
    }
    this.sessions.clear();
  }
}