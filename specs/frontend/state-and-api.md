# State Management & API Client Specification

## State Management (Zustand)

**File:** `src/store/pduStore.ts`

### Overview

Single Zustand store with devtools and persistence middleware. Holds all PDU-related data and UI state. Used as the primary client-side data cache alongside React Query's server cache.

### Middleware Stack

```typescript
create<PDUState>()(
  devtools(
    persist(
      (set, get) => ({ ... }),
      { name: 'pdu-store', partialize: ... }
    )
  )
)
```

| Middleware | Purpose |
|-----------|---------|
| `devtools` | Redux DevTools integration for debugging |
| `persist` | localStorage persistence (selective) |

### Persisted State

Only these fields survive page reload (via `partialize`):

```typescript
{
  pdus: PDU[];
  pollingInterval: number;
}
```

All other state (outlets, events, metrics, systemHealth, UI state) is transient and re-fetched on load.

### Store Interface

#### Data State

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pdus` | `PDU[]` | `[]` | All PDU objects |
| `outlets` | `Record<string, Outlet[]>` | `{}` | Outlets keyed by PDU ID |
| `events` | `PDUEvent[]` | `[]` | Recent events (max 100) |
| `metrics` | `PowerMetrics[]` | `[]` | Historical metrics (max 500) |
| `systemHealth` | `SystemHealth \| null` | `null` | Aggregate system health |

#### UI State

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `selectedPduId` | `string \| null` | `null` | Currently selected PDU |
| `isLoading` | `boolean` | `false` | Global loading flag |
| `error` | `string \| null` | `null` | Global error message |
| `pollingInterval` | `number` | `30000` | Polling interval in ms |

### Actions

#### PDU Actions

| Action | Signature | Behavior |
|--------|-----------|----------|
| `setPdus` | `(pdus: PDU[]) => void` | Replace entire PDU list |
| `addPdu` | `(pdu: PDU) => void` | Append to PDU list |
| `updatePdu` | `(id: string, updates: Partial<PDU>) => void` | Merge updates into matching PDU |
| `removePdu` | `(id: string) => void` | Remove PDU and its outlets from store |

#### Outlet Actions

| Action | Signature | Behavior |
|--------|-----------|----------|
| `setOutlets` | `(pduId: string, outlets: Outlet[]) => void` | Set outlets for a PDU |
| `updateOutlet` | `(pduId: string, outletId: string, updates: Partial<Outlet>) => void` | Merge updates into matching outlet |
| `reorderOutlets` | `(pduId: string, outlets: Outlet[]) => void` | Replace outlet array (same as `setOutlets`) |

#### Event Actions

| Action | Signature | Behavior |
|--------|-----------|----------|
| `addEvent` | `(event: PDUEvent) => void` | Prepend event, keep max 100 |
| `clearEvents` | `(pduId?: string) => void` | Clear events for PDU or all |

#### Other Actions

| Action | Signature | Behavior |
|--------|-----------|----------|
| `addMetrics` | `(metrics: PowerMetrics) => void` | Prepend metrics, keep max 500 |
| `setSystemHealth` | `(health: SystemHealth) => void` | Set system health |
| `setSelectedPdu` | `(id: string \| null) => void` | Set selected PDU ID |
| `setLoading` | `(loading: boolean) => void` | Set loading flag |
| `setError` | `(error: string \| null) => void` | Set error message |
| `setPollingInterval` | `(interval: number) => void` | Set polling interval |

### Helper Methods (Derived Data)

| Method | Signature | Logic |
|--------|-----------|-------|
| `getPduById` | `(id: string) => PDU \| undefined` | `pdus.find(pdu => pdu.id === id)` |
| `getOutletsByPduId` | `(pduId: string) => Outlet[]` | `outlets[pduId] \|\| []` |

---

## API Client

**File:** `src/api/pdu.ts`

### Overview

Singleton `PDUApiClient` class wrapping Axios. Exported as `pduApi`. Provides typed methods for all backend API endpoints.

### Configuration

| Setting | Value | Source |
|---------|-------|--------|
| Base URL | `VITE_API_URL` or `'/api'` | Environment variable |
| Timeout | `30000` ms | Hardcoded |
| Content-Type | `application/json` | Default header |

### Interceptors

#### Request Interceptor
- Auth headers handled by Authelia/K8s ingress (passthrough)

#### Response Interceptor
- On `401`: Redirects to `/auth/login`
- All other errors: Rejected promise (handled by callers)

### Endpoints

#### PDU Management

| Method | Endpoint | Params | Return Type |
|--------|----------|--------|-------------|
| `getPDUs()` | `GET /pdus` | - | `PDU[]` |
| `getPDU(id)` | `GET /pdus/:id` | `id: string` | `PDU` |
| `createPDU(pdu)` | `POST /pdus` | `Omit<PDU, 'id' \| 'createdAt' \| 'updatedAt'>` | `PDU` |
| `updatePDU(id, updates)` | `PUT /pdus/:id` | `id: string, updates: Partial<PDU>` | `PDU` |
| `deletePDU(id)` | `DELETE /pdus/:id` | `id: string` | `void` |
| `testPDUConnection(id)` | `POST /pdus/:id/test` | `id: string` | `{ success: boolean; message: string }` |

#### Outlet Management

| Method | Endpoint | Params | Return Type |
|--------|----------|--------|-------------|
| `getOutlets(pduId)` | `GET /pdus/:pduId/outlets` | `pduId: string` | `Outlet[]` |
| `getOutlet(pduId, outletId)` | `GET /pdus/:pduId/outlets/:outletId` | `pduId, outletId: string` | `Outlet` |
| `updateOutlet(pduId, outletId, updates)` | `PUT /pdus/:pduId/outlets/:outletId` | `updates: Partial<Outlet>` | `Outlet` |

#### Outlet Power Control

| Method | Endpoint | Body | Return Type |
|--------|----------|------|-------------|
| `setOutletPower(pduId, outletId, state)` | `POST /pdus/:pduId/outlets/:outletId/power` | `{ state: OutletOperation }` | `{ success: boolean; newState: OutletState }` |
| `bulkOutletControl(pduId, operation)` | `POST /pdus/:pduId/outlets/bulk` | `{ operation: OutletOperation }` | `{ success: boolean; affected: number }` |
| `reorderOutlets(pduId, outletIds)` | `PUT /pdus/:pduId/outlets/reorder` | `{ outletIds: string[] }` | `Outlet[]` |
| `resetOutletOrder(pduId)` | `PUT /pdus/:pduId/outlets/reset-order` | - | `Outlet[]` |

#### State History

| Method | Endpoint | Params | Return Type |
|--------|----------|--------|-------------|
| `getOutletHistory(pduId, outletId, limit?)` | `GET /pdus/:pduId/outlets/:outletId/history` | `limit: number (default 50)` | `OutletStateHistory[]` |

#### Events

| Method | Endpoint | Params | Return Type |
|--------|----------|--------|-------------|
| `getPDUEvents(pduId, limit?)` | `GET /pdus/:pduId/events` | `limit: number (default 100)` | `PDUEvent[]` |
| `getAllEvents(limit?)` | `GET /events` | `limit: number (default 100)` | `PDUEvent[]` |

#### Power Metrics

| Method | Endpoint | Params | Return Type |
|--------|----------|--------|-------------|
| `getPowerMetrics(pduId, startDate?, endDate?)` | `GET /pdus/:pduId/metrics` | `startDate/endDate: Date (ISO)` | `PowerMetrics[]` |
| `getCurrentPowerMetrics(pduId)` | `GET /pdus/:pduId/metrics/current` | `pduId: string` | `PowerMetrics` |

#### Scheduled Operations

| Method | Endpoint | Params | Return Type |
|--------|----------|--------|-------------|
| `getScheduledOperations(outletId?)` | `GET /scheduled-operations` | `outletId?: string` | `ScheduledOperation[]` |
| `createScheduledOperation(op)` | `POST /scheduled-operations` | `Omit<ScheduledOperation, 'id' \| 'createdAt' \| 'executed'>` | `ScheduledOperation` |
| `deleteScheduledOperation(id)` | `DELETE /scheduled-operations/:id` | `id: string` | `void` |

#### System Health

| Method | Endpoint | Return Type |
|--------|----------|-------------|
| `getSystemHealth()` | `GET /system/health` | `SystemHealth` |

#### API Keys

| Method | Endpoint | Params | Return Type |
|--------|----------|--------|-------------|
| `getApiKeys()` | `GET /api-keys` | - | `ApiKey[]` |
| `createApiKey(name)` | `POST /api-keys` | `{ name: string }` | `ApiKey` |
| `updateApiKey(id, updates)` | `PUT /api-keys/:id` | `{ name?: string; isActive?: boolean }` | `ApiKey` |
| `deleteApiKey(id)` | `DELETE /api-keys/:id` | `id: string` | `void` |

#### WebSocket

| Method | Params | Return |
|--------|--------|--------|
| `connectWebSocket(onMessage)` | `onMessage: (message: WsEnvelope) => void` | `WebSocket` |

- URL: API base with trailing `/api` removed, then `/ws`
- Auto-parses JSON messages and normalizes server envelopes to `{ type, channel?, data, timestamp? }`
- Logs parse errors and connection errors to console

---

## SNMP Constants (Frontend Reference)

**File:** `src/services/snmp.ts`

### Purpose

Read-only reference constants for APC PDU SNMP OIDs. Used for documentation/reference in the frontend; actual SNMP operations happen server-side.

### OID Map (`SNMP_OIDS`)

| Key | OID | Description |
|-----|-----|-------------|
| `rPDUIdentName` | `1.3.6.1.4.1.318.1.1.12.1.1` | PDU name |
| `rPDUOutletDevCommand` | `1.3.6.1.4.1.318.1.1.12.3.1.1.0` | Device-level all-outlet command |
| `rPDUOutletControlOutletCommand` | `1.3.6.1.4.1.318.1.1.12.3.3.1.1.4.` | Per-outlet command (append outlet #) |
| `rPDUOutletStatusIndex` | `1.3.6.1.4.1.318.1.1.12.3.5.1.1.1` | Outlet status index |
| `rPDUOutletStatusOutletName` | `1.3.6.1.4.1.318.1.1.12.3.5.1.1.2` | Outlet name |
| `rPDUOutletStatusOutletState` | `1.3.6.1.4.1.318.1.1.12.3.5.1.1.4` | Outlet state |
| `rPDULoadStatusLoad` | `1.3.6.1.4.1.318.1.1.12.2.3.1.1.2` | Current load |
| `rPDULoadStatusLoadState` | `1.3.6.1.4.1.318.1.1.12.2.3.1.1.3` | Load state |
| `rPDUIdentHardwareRev` | `1.3.6.1.4.1.318.1.1.12.1.2` | Hardware revision |
| `rPDUIdentFirmwareRev` | `1.3.6.1.4.1.318.1.1.12.1.3` | Firmware revision |
| `rPDUIdentModelNumber` | `1.3.6.1.4.1.318.1.1.12.1.5` | Model number |
| `rPDUIdentSerialNumber` | `1.3.6.1.4.1.318.1.1.12.1.6` | Serial number |

### Command Values (`SNMP_COMMANDS`)

| Context | Command | Value |
|---------|---------|-------|
| Outlet | ON | 1 |
| Outlet | OFF | 2 |
| Outlet | REBOOT | 3 |
| Device | ON_ALL | 2 |
| Device | OFF_ALL | 3 |
| Device | REBOOT_ALL | 4 |

### State Values (`SNMP_STATES`)

| Context | Value | Meaning |
|---------|-------|---------|
| Outlet | 1 | on |
| Outlet | 2 | off |
| Outlet | 3 | reboot |
| Load | 1 | normal |
| Load | 2 | low |
| Load | 3 | near_overload |
| Load | 4 | overload |

---

## Data Flow Summary

### React Query <-> Zustand Sync Pattern

Most pages fetch data with React Query and sync results to Zustand:

```
React Query (fetch) -> useEffect (sync) -> Zustand Store (cache)
                                              ^
Components read from store ──────────────────┘
```

This allows components deep in the tree (like Sidebar's PDUList) to access data without prop drilling, while React Query handles refetching, caching, and background updates.

### Polling Configuration

| Query | Interval | Page |
|-------|----------|------|
| PDU list | 30s | Dashboard |
| System health | 30s | Dashboard |
| Outlets | 10s | PDU Detail |
| Current metrics | 30s | PDU Detail |
| Recent events | 60s | Dashboard (RecentEventsCard) |
| All events | Manual only | Events page |
