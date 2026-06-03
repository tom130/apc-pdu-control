export type OutletState = 'on' | 'off';
export type OutletOperation = OutletState | 'reboot';
export type LoadState = 'normal' | 'low' | 'near_overload' | 'overload';
export type EventType = 'connection_lost' | 'connection_restored' | 'recovery_complete' | 'state_skew';
export type ChangeType = 'manual' | 'auto_recovery' | 'pdu_reboot' | 'sync' | 'scheduled';
export type SecurityLevel = 'noAuthNoPriv' | 'authNoPriv' | 'authPriv';

export interface PDU {
  id: string;
  name: string;
  ipAddress: string;
  model?: string;
  snmpVersion: string;
  snmpUser?: string;
  snmpAuthProtocol?: string;
  snmpPrivProtocol?: string;
  snmpSecurityLevel?: SecurityLevel;
  isActive: boolean;
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Outlet {
  id: string;
  pduId: string;
  outletNumber: number;
  name?: string;
  description?: string;
  displayOrder?: number;
  desiredState?: OutletState; // Legacy API field: restore snapshot, not a user target.
  actualState?: OutletState;
  lastStateChange?: Date;
  isCritical: boolean;
  autoRecovery: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OutletStateHistory {
  id: string;
  outletId: string;
  previousState?: OutletOperation;
  newState?: OutletOperation;
  changeType: ChangeType;
  initiatedBy: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface PDUEvent {
  id: string;
  pduId: string;
  eventType: EventType;
  description: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface PowerMetrics {
  id: string;
  pduId: string;
  totalPowerDraw: number;  // in Amperes
  totalPowerWatts?: number; // in Watts
  voltage?: number;         // in Volts (230V for EU)
  loadState: LoadState;
  timestamp: Date;
}

export interface ScheduledOperation {
  id: string;
  outletId: string;
  operation: OutletOperation;
  scheduledTime: Date;
  executed: boolean;
  createdAt: Date;
}

export interface CronSchedule {
  id: string;
  outletId: string;
  name: string;
  cronExpression: string;
  operation: OutletOperation;
  isActive: boolean;
  lastExecutedAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OutletSchedules {
  cron: CronSchedule[];
  oneTime: ScheduledOperation[];
}

export interface SNMPConfig {
  ipAddress: string;
  userProfile: string;
  authenticationPassphrase: string;
  authenticationProtocol: string;
  privacyPassphrase: string;
  privacyProtocol: string;
  securityLevel: SecurityLevel;
}

export interface SystemHealth {
  totalPdus: number;
  activePdus: number;
  totalOutlets: number;
  stateSkewPercentage: number;
  averageResponseTime: number;
  lastSystemCheck: Date;
}

export interface ApiKey {
  id: string;
  name: string;
  key?: string; // Only present on creation
  keyPreview: string;
  isActive: boolean;
  lastUsed?: Date;
  createdAt: Date;
}
