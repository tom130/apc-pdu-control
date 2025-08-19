// APC PDU SNMP OID definitions
// Based on http://oidref.com/1.3.6.1.4.1.318.1.1.12

export const SNMP_OIDS = {
  // PDU Identification
  rPDUIdentName: '1.3.6.1.4.1.318.1.1.12.1.1',
  
  // Device-level commands (all outlets)
  rPDUOutletDevCommand: '1.3.6.1.4.1.318.1.1.12.3.1.1.0',
  
  // Individual outlet control
  rPDUOutletControlOutletCommand: '1.3.6.1.4.1.318.1.1.12.3.3.1.1.4.',
  
  // Outlet status
  rPDUOutletStatusIndex: '1.3.6.1.4.1.318.1.1.12.3.5.1.1.1',
  rPDUOutletStatusOutletName: '1.3.6.1.4.1.318.1.1.12.3.5.1.1.2',
  rPDUOutletStatusOutletState: '1.3.6.1.4.1.318.1.1.12.3.5.1.1.4',
  
  // Power monitoring
  rPDULoadStatusLoad: '1.3.6.1.4.1.318.1.1.12.2.3.1.1.2',
  rPDULoadStatusLoadState: '1.3.6.1.4.1.318.1.1.12.2.3.1.1.3',
  
  // System information
  rPDUIdentHardwareRev: '1.3.6.1.4.1.318.1.1.12.1.2',
  rPDUIdentFirmwareRev: '1.3.6.1.4.1.318.1.1.12.1.3',
  rPDUIdentModelNumber: '1.3.6.1.4.1.318.1.1.12.1.5',
  rPDUIdentSerialNumber: '1.3.6.1.4.1.318.1.1.12.1.6',
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

// SNMP state values
export const SNMP_STATES = {
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