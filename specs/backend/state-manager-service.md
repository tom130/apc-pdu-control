# State Manager Service Spec

**File:** `backend/src/services/state-manager.service.ts`

## Purpose

Maintains the outlet restore snapshot and last observed state for PDU outlets. During stable online polling it captures each outlet's last-known state into the legacy `desiredState` column, which is now an automatic restore snapshot rather than a user target.

## Exports

### Class: `StateManager`

```typescript
constructor(
  db: PostgresJsDatabase<any>,
  snmpService: SNMPService
)
```

## Public API

| Method | Signature | Description |
|--------|-----------|-------------|
| `setWebSocketService` | `(wsService: WebSocketService) => void` | Injects WebSocket service for event broadcasting. |
| `updateOutletStates` | `(pdu: PDU, states: OutletStatus[], options?: { captureSnapshot?: boolean }) => Promise<void>` | Syncs SNMP-polled outlet states to the database and optionally captures restore snapshots on stable online polls. |
| `restoreFromPowerLoss` | `(pdu: PDU) => Promise<{ recovered: number; failed: number }>` | Restores managed outlets to their snapshots after an offline -> online edge. |

## State Model

Each outlet has two state fields:

| Field | Description |
|-------|-------------|
| `desiredState` | Legacy column reused as the automatic restore snapshot (`'on'`, `'off'`, or `null`); `reboot` is normalized to `'on'` |
| `actualState` | The last observed state from SNMP polling |

There is no user-managed target state. During normal stable operation, manual/front-panel/scheduled changes are respected and become the next restore snapshot.

The legacy desired-state reconciliation and reboot-skew recovery methods are removed.

## Outlet State Update Flow

`updateOutletStates(pdu, states, options)` processes each polled outlet:

1. **Existing outlet (found by pduId + outletNumber):**
   - If `actualState` changed:
     - UPDATE `actualState`, `lastStateChange`, `updatedAt`
     - Record state change in Prometheus (type: `auto_recovery`)
   - If `options.captureSnapshot` is true and the derived snapshot differs:
     - UPDATE `desiredState` to `deriveSnapshot(newState)`
2. **New outlet (not in database):**
   - INSERT new outlet with `displayOrder = outletNumber` and `desiredState = deriveSnapshot(newState)`

## Power-Loss Restore Flow

`restoreFromPowerLoss(pdu)` runs only when the scheduler observes an offline -> online edge.

1. Selects all outlets for the PDU.
2. Filters with `shouldRestore`:
   - `autoRecovery === true`
   - restore snapshot is `'on'` or `'off'`
   - snapshot differs from `actualState`
3. Sorts critical outlets first, then by outlet number.
4. For each outlet:
   - Runs the SNMP set plus DB update inside `withPduLock(pdu.id, ...)`
   - Calls `snmpService.setOutletPower(pdu, outletNumber, snapshot)`
   - Updates `actualState`, `lastStateChange`, and `updatedAt`
   - Logs `outlet_state_history` with `changeType = 'pdu_reboot'`, `initiatedBy = 'system'`
   - Broadcasts `outlet:state-changed`
   - Waits between outlet writes (critical: 2s, non-critical: 1s)
5. Inserts a `recovery_complete` PDU event with recovered/failed counts.

## Database Operations

### Tables Read

| Table | Query |
|-------|-------|
| `outlets` | Select by `pduId` + `outletNumber`; select all outlets by `pduId` for power-loss restore |

### Tables Written

| Table | Operation | Trigger |
|-------|-----------|---------|
| `outlets` | UPDATE `actualState`, `lastStateChange`, `updatedAt` | State change detected |
| `outlets` | UPDATE `desiredState`, `updatedAt` | Stable online snapshot capture |
| `outlets` | UPDATE `actualState`, `lastStateChange`, `updatedAt` | Power-loss restore write |
| `outlets` | INSERT | New outlet discovered during polling |
| `outletStateHistory` | INSERT | Every state change (success or failure) |
| `pduEvents` | INSERT `recovery_complete` | Power-loss restore complete |

## State Change History

Every state change is logged via `logStateChange()`:

```typescript
{
  outletId: string,
  previousState: string | null,
  newState: string | null,
  changeType: ChangeType,      // 'manual' | 'auto_recovery' | 'pdu_reboot' | 'sync'
  initiatedBy: string,         // 'system' for automated changes
  success: boolean,
  errorMessage?: string
}
```

## WebSocket Events Emitted

| Event | Trigger | Data |
|-------|---------|------|
| `outlet:state-changed` | Successful power-loss restore write | `{ pduId, outletId, outletNumber, newState }` |

## Dependencies

- `PostgresJsDatabase` (Drizzle ORM)
- `SNMPService` - applies outlet power states
- `WebSocketService` (injected via setter) - real-time events
- `PrometheusService` (lazy singleton) - state change and error metrics
- `ChangeType` from `../utils/constants`
- `PDU`, `outlets`, `outletStateHistory`, `pduEvents` from `../db/schema`
- `logger` from `../utils/logger`
- `deriveSnapshot` from `../utils/snapshot`
- `shouldRestore` from `./restore-predicate`
- `withPduLock` from `./pdu-lock`
- `Bun.sleep()` for delays during recovery

## Error Handling

- `updateOutletStates`: Creates new outlet entries if outlet not found in database
- `restoreFromPowerLoss`: Catches per-outlet failures, logs failed history rows, and returns recovered/failed counts
