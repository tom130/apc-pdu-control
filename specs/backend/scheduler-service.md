# Scheduler Service Spec

**File:** `backend/src/services/scheduler.service.ts`

## Purpose

Orchestrates periodic background tasks: polling PDU outlet states, tracking reachability edges, collecting power metrics, and running scheduled outlet operations. Acts as the central coordination point between SNMP polling, state management, database persistence, WebSocket broadcasting, and Prometheus metrics.

## Exports

### Class: `SchedulerService`

```typescript
constructor(
  db: PostgresJsDatabase<any>,
  snmpService: SNMPService,
  stateManager: StateManager
)
```

## Public API

| Method | Signature | Description |
|--------|-----------|-------------|
| `start` | `() => void` | Starts all periodic jobs and runs an initial poll. Idempotent (warns if already running). |
| `stop` | `() => void` | Clears all intervals and sets `isRunning` to `false`. |

## Scheduled Jobs

| Job | Interval | Default | Env Var | Description |
|-----|----------|---------|---------|-------------|
| Poll PDUs | `INTERVALS.POLL` | 30s | `POLL_INTERVAL` | Fetch outlet states from all active PDUs |
| Collect Metrics | `INTERVALS.METRICS` | 300s (5min) | `METRICS_INTERVAL` | Collect power draw/consumption metrics |
| Check Scheduled Operations | `INTERVALS.SCHEDULE_CHECK` | 60s | `SCHEDULE_CHECK_INTERVAL` | Runs one-time and cron outlet schedules through a single execution path |

All intervals are configured via the `INTERVALS` constant from `utils/constants.ts`.

The schedule implementation has exactly one source path for `checkScheduledOperations`,
`executeOneTimeSchedules`, `executeCronSchedules`, and `executeScheduledOperation`.
The dedupe invariant is covered by `backend/src/services/__tests__/scheduler.dedupe.test.ts`.

Scheduled outlet writes run the SNMP set plus outlet DB update inside `withPduLock(pduId, ...)`.
One-time scheduled operations are atomically claimed with
`claimScheduledOperation()` before any SNMP command is issued. Cron schedules advance
`nextRunAt`/`lastExecutedAt` before issuing the SNMP command, so each due cron tick is
processed at most once by this scheduler loop.

## Job Details

### pollAllPDUs

1. Queries all active PDUs from the database (`isActive = true`)
2. Polls each PDU concurrently via `Promise.allSettled()` (individual failures don't block others)
3. For each PDU (`pollPDU`):

**On success:**
- Probes reachability via `snmpService.probeReachable(pdu)` before reading outlets
- Fetches outlet states via `snmpService.getOutletStates(pdu)`
- Updates Prometheus outlet and PDU status metrics
- Computes reachability edge from the previous in-memory/`lastSeen`-seeded state to `online`
- Persists state changes via `stateManager.updateOutletStates(pdu, states, { captureSnapshot })`
  - `captureSnapshot` is true only for stable online polls and false on offline -> online edges
- Updates `lastSeen` timestamp in the database
- Inserts `connection_restored` only on an offline -> online edge
- Runs `stateManager.restoreFromPowerLoss(pdu)` through the per-PDU restore guard on an offline -> online edge
- Broadcasts `pdu:status-update` on WebSocket channel `pdu:<pduId>`

**On failure:**
- Updates Prometheus: marks PDU offline, records poll error and connection error
- Computes reachability edge from the previous in-memory/`lastSeen`-seeded state to `offline`
- Inserts `connection_lost` only on an online -> offline edge
- Broadcasts offline status on WebSocket channel `pdu:<pduId>`
- Does not call `stateManager.updateOutletStates`; last-known outlet rows are preserved while the PDU is offline

**Always:**
- Records poll duration via Prometheus poll timer

### collectMetrics

1. Queries all active PDUs
2. Processes each PDU **sequentially**
3. Fetches power metrics via `snmpService.getPowerMetrics(pdu)`
4. Skips PDUs that return `null` (power monitoring unsupported)
5. Updates Prometheus power metrics
6. Inserts metrics into `powerMetrics` database table
7. Broadcasts `metrics:updated` on WebSocket channel `pdu:<pduId>`
8. If load state is `overload` or `near_overload`:
   - Logs warning
   - Inserts `state_skew` event into `pduEvents` table with power data

### checkScheduledOperations

1. Skips when a previous schedule check is still running in this process.
2. For one-time schedules:
   - Reads due, unexecuted operations.
   - Logs when the schedule is older than `2 * INTERVALS.SCHEDULE_CHECK`.
   - Atomically claims the row (`executed = true`, `executedAt = now`) with `executed = false` in the `WHERE` clause.
   - Executes only if the claim returns a row.
3. For cron schedules:
   - Reads active schedules whose `nextRunAt <= now`.
   - Logs when the schedule is older than `2 * INTERVALS.SCHEDULE_CHECK`.
   - Advances `lastExecutedAt`, `nextRunAt`, and `updatedAt` before issuing SNMP.
   - Executes the outlet operation through the shared scheduled-operation path.

## Startup Behavior

On `start()`:
1. Sets `isRunning = true`
2. Creates three `setInterval` timers
3. Immediately runs `pollAllPDUs()` (initial poll, errors caught but don't prevent startup)

## WebSocket Events Emitted

| Event | Channel | Trigger | Data |
|-------|---------|---------|------|
| `pdu:status-update` | `pdu:<pduId>` | Successful poll | `{ pduId, status: 'online', outletStates, lastSeen }` |
| `pdu:status-update` | `pdu:<pduId>` | Failed poll | `{ pduId, status: 'offline', error }` |
| `metrics:updated` | `pdu:<pduId>` | Metrics collection | `{ pduId, metrics, timestamp }` |

## Database Tables Written

| Table | Operation | Trigger |
|-------|-----------|---------|
| `pdus` | UPDATE `lastSeen` | Successful poll |
| `pduEvents` | INSERT `connection_lost` | Online -> offline reachability edge |
| `pduEvents` | INSERT `connection_restored` | Offline -> online reachability edge |
| `pduEvents` | INSERT `state_skew` | Overload/near-overload detected |
| `powerMetrics` | INSERT | Metrics collection |

## Dependencies

- `PostgresJsDatabase` (Drizzle ORM) - database access
- `SNMPService` - SNMP communication
- `StateManager` - outlet-state persistence and power-loss restore
- `createRestoreGuard` - per-PDU one-shot restore guard
- `withPduLock` - per-PDU serialization for scheduled outlet writes
- `WebSocketService` (singleton) - real-time client updates
- `PrometheusService` (lazy singleton) - metrics recording
- `INTERVALS` from `../utils/constants`
- `pdus`, `outlets`, `powerMetrics`, `pduEvents` from `../db/schema`
- `logger` from `../utils/logger`

## Error Handling

- All top-level job errors are caught and logged (never crash the scheduler)
- `pollAllPDUs` uses `Promise.allSettled` so individual PDU failures are isolated
- `collectMetrics` catches errors per-PDU
- `start()` is idempotent; calling it twice logs a warning and returns
