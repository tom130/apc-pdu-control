// SNMP OID definitions for APC PDUs
export const SNMP_OIDS = {
  // PDU Identification (note: scalar OIDs need .0 at the end)
  rPDUIdentName: '1.3.6.1.4.1.318.1.1.12.1.1.0',
  rPDUIdentHardwareRev: '1.3.6.1.4.1.318.1.1.12.1.2.0',
  rPDUIdentFirmwareRev: '1.3.6.1.4.1.318.1.1.12.1.3.0',
  rPDUIdentModelNumber: '1.3.6.1.4.1.318.1.1.12.1.5.0',
  rPDUIdentSerialNumber: '1.3.6.1.4.1.318.1.1.12.1.6.0',
  
  // Device-level commands (all outlets)
  rPDUOutletDevCommand: '1.3.6.1.4.1.318.1.1.12.3.1.1.0',
  
  // Individual outlet control
  rPDUOutletControlOutletCommand: '1.3.6.1.4.1.318.1.1.12.3.3.1.1.4.',
  
  // Outlet status (newer PDUs - 2G)
  rPDUOutletStatusIndex: '1.3.6.1.4.1.318.1.1.12.3.5.1.1.1',
  rPDUOutletStatusOutletName: '1.3.6.1.4.1.318.1.1.12.3.5.1.1.2',
  rPDUOutletStatusOutletState: '1.3.6.1.4.1.318.1.1.12.3.5.1.1.4',
  
  // Outlet status (older PDUs - 1G like AP7951)
  rPDUOutletStatusOutletNameOld: '1.3.6.1.4.1.318.1.1.4.5.2.1.3',
  rPDUOutletStatusOutletStateOld: '1.3.6.1.4.1.318.1.1.4.4.2.1.3',
  rPDUOutletControlOutletCommandOld: '1.3.6.1.4.1.318.1.1.4.4.2.1.4.',
  
  // Power monitoring (2G format - works on AP7951 with index)
  rPDULoadStatusLoad: '1.3.6.1.4.1.318.1.1.12.2.3.1.1.2',       // Base OID (table)
  rPDULoadStatusLoadState: '1.3.6.1.4.1.318.1.1.12.2.3.1.1.3',  // Base OID (table)
  
  // Indexed versions for AP7951 and similar PDUs (add .1 for first bank/phase)
  rPDULoadStatusLoadIndexed: '1.3.6.1.4.1.318.1.1.12.2.3.1.1.2.1',      // Current in tenths of amps
  rPDULoadStatusLoadStateIndexed: '1.3.6.1.4.1.318.1.1.12.2.3.1.1.3.1', // Load state
  
  // Power monitoring (older PDUs - 1G) - Note: Many 1G PDUs don't support power monitoring
  rPDULoadPhaseStatusCurrent: '1.3.6.1.4.1.318.1.1.4.3.3.1.4',
  rPDULoadPhaseStatusLoadState: '1.3.6.1.4.1.318.1.1.4.3.3.1.6',
} as const;

// SNMP command values
export const SNMP_COMMANDS = {
  OUTLET: {
    ON: 1,
    OFF: 2,
    REBOOT: 3,
  },
  DEVICE: {
    ON_ALL: 2,
    OFF_ALL: 3,
    REBOOT_ALL: 4,
  },
} as const;

// SNMP state mappings
export const SNMP_STATE_MAP = {
  OUTLET: {
    1: 'on',
    2: 'off',
    3: 'reboot',
  },
  LOAD: {
    1: 'normal',
    2: 'low',
    3: 'near_overload',
    4: 'overload',
  },
} as const;

// Outlet state types
export type OutletState = 'on' | 'off' | 'reboot';
export type LoadState = 'normal' | 'low' | 'near_overload' | 'overload';
export type ChangeType = 'manual' | 'auto_recovery' | 'pdu_reboot' | 'sync';
export type EventType = 'reboot' | 'connection_lost' | 'connection_restored' | 'state_skew';

// Polling intervals (can be overridden by env vars)
export const INTERVALS = {
  POLL: parseInt(process.env.POLL_INTERVAL || '30000'),
  RECONCILE: parseInt(process.env.RECONCILE_INTERVAL || '60000'),
  METRICS: parseInt(process.env.METRICS_INTERVAL || '300000'),
} as const;