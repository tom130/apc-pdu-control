# TypeScript Type Definitions Specification

**File:** `src/types/pdu.ts`

## Type Aliases

### OutletState / OutletOperation

```typescript
type OutletState = 'on' | 'off';
type OutletOperation = OutletState | 'reboot';
```

`OutletState` is the observed persisted outlet state. `OutletOperation` is used for commands and schedules, where `reboot` is valid but normalizes back to `on` after success.

### LoadState

```typescript
type LoadState = 'normal' | 'low' | 'near_overload' | 'overload';
```

Power load classification for a PDU. Maps to SNMP load state values (1-4).

### EventType

```typescript
type EventType = 'connection_lost' | 'connection_restored' | 'recovery_complete' | 'state_skew';
```

Categories of system events tracked in the event log.

### ChangeType

```typescript
type ChangeType = 'manual' | 'auto_recovery' | 'pdu_reboot' | 'sync';
```

Source/reason for an outlet state change. Used in state history tracking.

### SecurityLevel

```typescript
type SecurityLevel = 'noAuthNoPriv' | 'authNoPriv' | 'authPriv';
```

SNMPv3 security levels. Determines which authentication/privacy fields are required.

---

## Interfaces

### PDU

```typescript
interface PDU {
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
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | UUID |
| `name` | Yes | Display name (e.g., "PDU-01") |
| `ipAddress` | Yes | Network address for SNMP communication |
| `model` | No | Hardware model (e.g., "AP7920B") |
| `snmpVersion` | Yes | Protocol version: `'v1'`, `'v2c'`, or `'v3'` |
| `snmpUser` | No | Community string (v1/v2c) or username (v3) |
| `snmpAuthProtocol` | No | v3 auth protocol: `'SHA'` or `'MD5'` |
| `snmpPrivProtocol` | No | v3 privacy protocol: `'AES'` or `'DES'` |
| `snmpSecurityLevel` | No | v3 security level |
| `isActive` | Yes | Whether the PDU is actively monitored |
| `lastSeen` | No | Timestamp of last successful SNMP poll |
| `createdAt` | Yes | Record creation timestamp |
| `updatedAt` | Yes | Last modification timestamp |

### Outlet

```typescript
interface Outlet {
  id: string;
  pduId: string;
  outletNumber: number;
  name?: string;
  description?: string;
  displayOrder?: number;
  desiredState?: OutletState;
  actualState?: OutletState;
  lastStateChange?: Date;
  isCritical: boolean;
  autoRecovery: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | UUID |
| `pduId` | Yes | Parent PDU reference |
| `outletNumber` | Yes | Physical outlet number on the PDU |
| `name` | No | User-assigned name (e.g., "Web Server") |
| `description` | No | Additional description |
| `displayOrder` | No | Custom sort position for UI reordering |
| `desiredState` | No | Legacy API field for restore snapshot, not a user-managed target |
| `actualState` | No | Current state as reported by SNMP |
| `lastStateChange` | No | When the actual state last changed |
| `isCritical` | Yes | If true, power toggle and reboot are disabled in UI |
| `autoRecovery` | Yes | Whether to include outlet in power-loss restore |
| `createdAt` | Yes | Record creation timestamp |
| `updatedAt` | Yes | Last modification timestamp |

The UI does not expose `desiredState` as a target state; outlet cards show auto-restore and critical flags instead.

### OutletStateHistory

```typescript
interface OutletStateHistory {
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
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | UUID |
| `outletId` | Yes | Outlet reference |
| `previousState` | No | State before the change |
| `newState` | No | State after the change |
| `changeType` | Yes | What triggered the change |
| `initiatedBy` | Yes | User or system identifier |
| `timestamp` | Yes | When the change occurred |
| `success` | Yes | Whether the operation succeeded |
| `errorMessage` | No | Error details if `success` is false |

### PDUEvent

```typescript
interface PDUEvent {
  id: string;
  pduId: string;
  eventType: EventType;
  description: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | UUID |
| `pduId` | Yes | Associated PDU |
| `eventType` | Yes | Event category |
| `description` | Yes | Human-readable event description |
| `metadata` | No | Arbitrary JSON data for event context |
| `timestamp` | Yes | When the event occurred |

### PowerMetrics

```typescript
interface PowerMetrics {
  id: string;
  pduId: string;
  totalPowerDraw: number;
  totalPowerWatts?: number;
  voltage?: number;
  loadState: LoadState;
  timestamp: Date;
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | UUID |
| `pduId` | Yes | Associated PDU |
| `totalPowerDraw` | Yes | Current draw in Amperes |
| `totalPowerWatts` | No | Power in Watts (fallback: `totalPowerDraw * 230`) |
| `voltage` | No | Voltage in Volts (default: 230V for EU) |
| `loadState` | Yes | Load classification |
| `timestamp` | Yes | Measurement timestamp |

### ScheduledOperation

```typescript
interface ScheduledOperation {
  id: string;
  outletId: string;
  operation: OutletOperation;
  scheduledTime: Date;
  executed: boolean;
  createdAt: Date;
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | UUID |
| `outletId` | Yes | Target outlet |
| `operation` | Yes | Desired power operation |
| `scheduledTime` | Yes | When to execute |
| `executed` | Yes | Whether already executed |
| `createdAt` | Yes | When the schedule was created |

### SNMPConfig

```typescript
interface SNMPConfig {
  ipAddress: string;
  userProfile: string;
  authenticationPassphrase: string;
  authenticationProtocol: string;
  privacyPassphrase: string;
  privacyProtocol: string;
  securityLevel: SecurityLevel;
}
```

Configuration object for SNMPv3 connections. Used as a reference type; actual SNMP operations are server-side.

### SystemHealth

```typescript
interface SystemHealth {
  totalPdus: number;
  activePdus: number;
  totalOutlets: number;
  stateSkewPercentage: number;
  averageResponseTime: number;
  lastSystemCheck: Date;
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `totalPdus` | Yes | Total configured PDUs |
| `activePdus` | Yes | PDUs currently responding |
| `totalOutlets` | Yes | Total outlets across all PDUs |
| `stateSkewPercentage` | Yes | Legacy API field displayed as restore drift percentage |
| `averageResponseTime` | Yes | Average SNMP response time in ms |
| `lastSystemCheck` | Yes | When health was last computed |

### ApiKey

```typescript
interface ApiKey {
  id: string;
  name: string;
  key?: string;
  keyPreview: string;
  isActive: boolean;
  lastUsed?: Date;
  createdAt: Date;
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | UUID |
| `name` | Yes | Display name (e.g., "Home Assistant") |
| `key` | No | Full key value - **only present on creation response** |
| `keyPreview` | Yes | Truncated key for display (e.g., "apc_abc12...") |
| `isActive` | Yes | Whether the key is enabled |
| `lastUsed` | No | Last time the key was used for authentication |
| `createdAt` | Yes | When the key was created |

---

## Type Usage Patterns

### Form State Types

Dialogs (AddPDUDialog, PDUConfigDialog, Settings) use inline object types for form state rather than referencing these interfaces directly, since form state includes mutable fields (passphrases) that differ from the API response types.

### Partial Updates

API update methods use `Partial<PDU>` and `Partial<Outlet>` for flexible partial updates. The store's `updatePdu` and `updateOutlet` merge these partials with existing objects.

### Omit for Creation

PDU creation uses `Omit<PDU, 'id' | 'createdAt' | 'updatedAt'>` since the server generates these fields.
