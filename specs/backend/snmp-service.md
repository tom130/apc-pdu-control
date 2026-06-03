# SNMP Service Spec

**File:** `backend/src/services/snmp.service.ts`

## Purpose

Manages all SNMP communication with APC PDU hardware. Provides session management, outlet state reading/writing, power metrics collection, and PDU identification. Supports both legacy (1G) and modern (2G) APC PDU models, as well as SNMPv1, v2c, and v3 protocols.

## Exports

### Class: `SNMPService`

Instantiated directly (not a singleton). Maintains a pool of SNMP sessions keyed by PDU ID.

## Interfaces

```typescript
interface OutletStatus {
  outletNumber: number;
  name: string;
  state: OutletState; // 'on' | 'off' | 'reboot'
}

interface PowerMetrics {
  totalPowerDraw: number;  // Amperes (converted from tenths-of-amps)
  totalPowerWatts: number; // Calculated: Amps * 230V (EU standard)
  loadState: LoadState;    // 'normal' | 'low' | 'near_overload' | 'overload'
  voltage: number;         // Hardcoded 230V EU standard
}
```

## Public API

| Method | Signature | Description |
|--------|-----------|-------------|
| `testConnection` | `(pdu: PDU) => Promise<{ success: boolean; message: string }>` | Tests SNMP connectivity by fetching PDU name. Creates a disposable read session. |
| `getPDUInfo` | `(pdu: PDU) => Promise<{ name, model, serialNumber, firmware }>` | Fetches PDU identification OIDs (name, model, serial, firmware). |
| `probeReachable` | `(pdu: PDU) => Promise<void>` | Performs a single read-session GET against the PDU identity OID. Rejects on timeout/connectivity errors so the scheduler can mark the PDU offline before walking outlet rows. |
| `getOutletStates` | `(pdu: PDU) => Promise<OutletStatus[]>` | Walks outlet name and state OIDs. Tries 2G OIDs first, falls back to 1G OIDs. |
| `setOutletPower` | `(pdu: PDU, outletNumber: number, state: OutletState) => Promise<boolean>` | Sets individual outlet state via SNMP SET. Tries 2G OID first, falls back to 1G on `NoSuchName`. |
| `setAllOutlets` | `(pdu: PDU, state: 'on' \| 'off' \| 'reboot') => Promise<boolean>` | Sends device-level command to control all outlets at once. |
| `getPowerMetrics` | `(pdu: PDU) => Promise<PowerMetrics \| null>` | Fetches load current and state. Tries indexed OIDs first, then non-indexed. Returns `null` if unsupported. |
| `closeSession` | `(pduId: string) => void` | Closes and removes a specific session by PDU ID. |
| `closeAllSessions` | `() => void` | Closes all cached sessions. |

## SNMP Version Support

The service supports three SNMP versions based on `pdu.snmpVersion`:

### v1 / v2c (Community-based)
- **Read operations:** Uses `'public'` community string
- **Write operations:** Uses `pdu.snmpUser` as community string (defaults to `'public'`)
- Session created via `snmp.createSession()`

### v3 (USM-based)
- Default version when `snmpVersion` is unset
- Supports three security levels:

| Security Level | Auth Required | Priv Required | Fields Used |
|----------------|---------------|---------------|-------------|
| `noAuthNoPriv` | No | No | `snmpUser` |
| `authNoPriv` | Yes | No | `snmpUser`, `snmpAuthPassphrase` (encrypted), `snmpAuthProtocol` (default: `sha`) |
| `authPriv` | Yes | Yes | All above + `snmpPrivPassphrase` (encrypted), `snmpPrivProtocol` (default: `aes`) |

- Auth/priv passphrases are decrypted at session creation time using `decrypt()` from crypto utils
- Session created via `snmp.createV3Session()`

## Session Management

- Sessions are cached in `Map<string, any>` keyed by PDU ID
- Read sessions are keyed as `"${pduId}-read"` (separate from write sessions)
- Sessions are reused across calls via `getOrCreateSession(pdu, forRead)`
- `testConnection()` creates a one-off session that is immediately closed
- Repeated failed reachability probes close cached read and write sessions for that PDU so a stale session is rebuilt on the next attempt
- Sessions use SNMP port 161, configurable timeout/retries, 32-bit ID size

## PDU Generation Fallback Strategy

The service handles both 1G (e.g., AP7951) and 2G APC PDUs:

| Operation | 2G OID (tried first) | 1G OID (fallback) |
|-----------|----------------------|---------------------|
| Outlet names | `rPDUOutletStatusOutletName` | `rPDUOutletStatusOutletNameOld` |
| Outlet states | `rPDUOutletStatusOutletState` | `rPDUOutletStatusOutletStateOld` |
| Outlet control | `rPDUOutletControlOutletCommand` | `rPDUOutletControlOutletCommandOld` |
| Power load | `rPDULoadStatusLoadIndexed` | `rPDULoadStatusLoad` |
| Load state | `rPDULoadStatusLoadStateIndexed` | `rPDULoadStatusLoadState` |

- `getOutletStates`: Falls back when walk returns empty results
- `setOutletPower`: Falls back on `NoSuchName` error from the SET command
- `getPowerMetrics`: Falls back when first GET returns no data; returns `null` if both fail

## OID Walking

Private method `walkOID(session, oid)` performs SNMP WALK with:
- `maxRepetitions = 20` (for v2c/v3 GETBULK)
- Filters results to only include varbinds matching the base OID prefix
- Rejects on `RequestTimedOutError` so powered-off/unreachable PDUs surface as offline
- Gracefully resolves with partial results on non-timeout walk errors such as unsupported/partial subtrees

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `SNMP_TIMEOUT` | `5000` | SNMP request timeout (ms) |
| `SNMP_RETRIES` | `3` | Number of SNMP retries |

## Dependencies

- `net-snmp` - SNMP protocol library
- `PDU` type from `../db/schema`
- `SNMP_OIDS`, `SNMP_COMMANDS`, `SNMP_STATE_MAP`, `OutletState`, `LoadState` from `../utils/constants`
- `decrypt` from `../utils/crypto` (for decrypting SNMPv3 passphrases)
- `logger` from `../utils/logger`
- `PrometheusService` (lazy singleton) for timing and error metrics

## Prometheus Integration

- `getOutletStates` and `setOutletPower` are timed via `startSNMPTimer()`
- `getPowerMetrics` is timed via `startSNMPTimer()`
- Errors in `getOutletStates` and `setOutletPower` are recorded via `recordError()`
- PrometheusService is lazily resolved to avoid circular initialization issues

## Error Handling

- `createSession` throws if `snmpUser` is missing for write operations
- `createSession` throws if auth/priv passphrases are missing for corresponding security levels
- `testConnection` catches all errors and returns `{ success: false, message }` (never throws)
- `probeReachable` rejects on SNMP GET errors and resets repeated failed cached sessions
- `getPowerMetrics` returns `null` rather than throwing when metrics are unsupported
- `walkOID` rejects timeout errors and resolves partial results on non-timeout walk errors
- SNMP errors are logged with PDU context before being propagated

## Data Flow

```
API Route -> SNMPService.getOutletStates(pdu)
          -> getOrCreateSession(pdu, forRead=true)
          -> walkOID(session, nameOID)  // 2G first, then 1G
          -> walkOID(session, stateOID) // 2G first, then 1G
          -> Map results to OutletStatus[]
          -> PrometheusService records timing
```

```
API Route -> SNMPService.setOutletPower(pdu, outlet, state)
          -> getOrCreateSession(pdu, forRead=false)
          -> session.set(2G OID)
          -> On NoSuchName: session.set(1G OID)
          -> PrometheusService records timing
```
