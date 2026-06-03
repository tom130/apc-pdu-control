# Backend API Routes Spec

## Overview

The APC PDU Control backend exposes a REST API built with [Elysia](https://elysiajs.com/) (Bun-native HTTP framework). Routes are organized into six route modules, grouped under `/api` (except M2M and top-level endpoints). All request/response validation uses Elysia's `t` (TypeBox) schema validators.

Base URL: `http://{HOST}:{PORT}` (default `0.0.0.0:3001`)

---

## Top-Level Endpoints

These are registered directly on the app, outside the `/api` group.

### `GET /health`

Basic health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-09T00:00:00.000Z",
  "uptime": 12345.678
}
```

### `GET /metrics`

Prometheus metrics endpoint. Returns metrics in Prometheus text exposition format.

- Returns `404` if `PROMETHEUS_ENABLED=false`
- Sets `Content-Type` to Prometheus content type
- Returns `500` on generation failure

### `WS /ws`

WebSocket endpoint for real-time updates (handled by `WebSocketService`).

---

## PDU Routes (`/api/pdus`)

**Source:** `backend/src/routes/pdu.routes.ts`
**Prefix:** `/pdus` (mounted under `/api`)

### `GET /api/pdus`

List all PDUs.

**Response:** `PDU[]`

### `GET /api/pdus/:pduId`

Get a single PDU by ID.

| Param   | Type   | Validation        |
|---------|--------|-------------------|
| `pduId` | string | UUID format       |

**Response:** `PDU` object
**Error:** `404` `{ error: "PDU not found" }`

### `POST /api/pdus`

Create a new PDU. Encrypts SNMP auth/priv passphrases before storage.

**Body Schema:**

| Field                | Type   | Required | Validation       |
|----------------------|--------|----------|------------------|
| `name`               | string | yes      | `minLength: 1`   |
| `ipAddress`          | string | yes      | IPv4 format      |
| `model`              | string | no       |                  |
| `snmpVersion`        | string | no       | default: `"v3"`  |
| `snmpUser`           | string | no       |                  |
| `snmpAuthProtocol`   | string | no       |                  |
| `snmpAuthPassphrase` | string | no       |                  |
| `snmpPrivProtocol`   | string | no       |                  |
| `snmpPrivPassphrase` | string | no       |                  |
| `snmpSecurityLevel`  | string | no       | default: `"noAuthNoPriv"` |

**SNMP Validation Rules:**
- SNMPv3 requires `snmpUser`
- `authNoPriv` / `authPriv` security levels require `snmpAuthPassphrase`
- `authPriv` security level requires `snmpPrivPassphrase`

**Response:** Created `PDU` object
**Error:** `400` `{ error: "<validation message>" }`

### `PUT /api/pdus/:pduId`

Update an existing PDU. Partial updates supported. Encrypts passphrases if provided. Merges with existing data for SNMP validation.

| Param   | Type   | Validation  |
|---------|--------|-------------|
| `pduId` | string | UUID format |

**Body Schema (all fields optional):**

| Field                | Type    |
|----------------------|---------|
| `name`               | string  |
| `ipAddress`          | string (IPv4) |
| `model`              | string  |
| `isActive`           | boolean |
| `snmpUser`           | string  |
| `snmpAuthProtocol`   | string  |
| `snmpAuthPassphrase` | string  |
| `snmpPrivProtocol`   | string  |
| `snmpPrivPassphrase` | string  |
| `snmpSecurityLevel`  | string  |

**Response:** Updated `PDU` object
**Errors:** `404` PDU not found, `400` SNMP validation failure

### `DELETE /api/pdus/:pduId`

Delete a PDU. Cascades to all related outlets, history, events, metrics.

| Param   | Type   | Validation  |
|---------|--------|-------------|
| `pduId` | string | UUID format |

**Response:** `{ success: true, deleted: PDU }`
**Error:** `404` `{ error: "PDU not found" }`

### `POST /api/pdus/:pduId/test`

Test SNMP connection to the PDU.

| Param   | Type   | Validation  |
|---------|--------|-------------|
| `pduId` | string | UUID format |

**Dependencies:** `snmpService.testConnection(pdu)`
**Response:** SNMP test result object
**Error:** `404` PDU not found

---

## Outlet Routes (`/api/pdus/:pduId/outlets`)

**Source:** `backend/src/routes/outlet.routes.ts`
**Prefix:** `/pdus/:pduId/outlets` (mounted under `/api`)

### `GET /api/pdus/:pduId/outlets`

List all outlets for a PDU, ordered by `displayOrder`.

| Param   | Type   | Validation  |
|---------|--------|-------------|
| `pduId` | string | UUID format |

**Response:** `Outlet[]`

### `GET /api/pdus/:pduId/outlets/:outletId`

Get a single outlet.

| Param      | Type   | Validation  |
|------------|--------|-------------|
| `pduId`    | string | UUID format |
| `outletId` | string | UUID format |

**Response:** `Outlet` object
**Error:** `404` `{ error: "Outlet not found" }`

### `PUT /api/pdus/:pduId/outlets/:outletId`

Update outlet metadata (not power state).

| Param      | Type   | Validation  |
|------------|--------|-------------|
| `pduId`    | string | UUID format |
| `outletId` | string | UUID format |

**Body Schema (all fields optional):**

| Field          | Type    |
|----------------|---------|
| `name`         | string  |
| `description`  | string  |
| `isCritical`   | boolean |
| `autoRecovery` | boolean |

**Response:** Updated `Outlet` object
**Error:** `404` `{ error: "Outlet not found" }`

### `POST /api/pdus/:pduId/outlets/:outletId/power`

Change outlet power state via SNMP. Logs state change to history. Broadcasts WebSocket event `outlet:state-changed`.

| Param      | Type   | Validation  |
|------------|--------|-------------|
| `pduId`    | string | UUID format |
| `outletId` | string | UUID format |

**Body Schema:**

| Field   | Type   | Required | Values                    |
|---------|--------|----------|---------------------------|
| `state` | string | yes      | `"on"`, `"off"`, `"reboot"` |

**Success Response:**
```json
{ "success": true, "newState": "on" }
```

**Error Response (500):**
```json
{ "success": false, "error": "<message>" }
```

**Side Effects:**
- Updates `outlets.actualState`, `outlets.desiredState` (restore snapshot), `lastStateChange`, `updatedAt` in DB
- `reboot` is persisted as `actualState = desiredState = "on"`
- SNMP set plus outlet DB update run inside `withPduLock(pduId, ...)`
- Inserts into `outlet_state_history` (success or failure)
- WebSocket broadcast: `outlet:state-changed`

### `GET /api/pdus/:pduId/outlets/:outletId/history`

Get state change history for an outlet.

| Param      | Type   | Validation  |
|------------|--------|-------------|
| `pduId`    | string | UUID format |
| `outletId` | string | UUID format |

**Query Parameters:**

| Param   | Type   | Default | Validation      |
|---------|--------|---------|-----------------|
| `limit` | number | 50      | min: 1, max: 100 |

**Response:** `OutletStateHistory[]` (ordered by timestamp descending)

### `PUT /api/pdus/:pduId/outlets/reorder`

Reorder outlets within a PDU. Runs in a database transaction. Broadcasts WebSocket event `outlets:reordered`.

| Param   | Type   | Validation  |
|---------|--------|-------------|
| `pduId` | string | UUID format |

**Body Schema:**

| Field       | Type     | Required | Description                    |
|-------------|----------|----------|--------------------------------|
| `outletIds` | string[] | yes      | Array of outlet UUIDs in order |

**Validation:**
- All provided IDs must belong to the specified PDU
- All existing outlets must be included (count must match)

**Response:** Reordered `Outlet[]`
**Errors:** `400` invalid outlet IDs or incomplete list, `500` transaction failure

### `PUT /api/pdus/:pduId/outlets/reset-order`

Reset outlet display order to match outlet numbers. Broadcasts WebSocket event `outlets:reordered`.

| Param   | Type   | Validation  |
|---------|--------|-------------|
| `pduId` | string | UUID format |

**Response:** Reordered `Outlet[]`

### `POST /api/pdus/:pduId/outlets/bulk`

Bulk power operation on all outlets of a PDU. Broadcasts WebSocket event `outlets:bulk-changed`.

| Param   | Type   | Validation  |
|---------|--------|-------------|
| `pduId` | string | UUID format |

**Body Schema:**

| Field       | Type   | Required | Values                    |
|-------------|--------|----------|---------------------------|
| `operation` | string | yes      | `"on"`, `"off"`, `"reboot"` |

**Success Response:**
```json
{ "success": true, "affected": 8 }
```

**Error Response (500):**
```json
{ "success": false, "error": "<message>" }
```

**Side Effects:**
- Updates all outlets' `actualState` and restore snapshot (`desiredState`) to `deriveSnapshot(operation)`
- `reboot` is persisted as `actualState = desiredState = "on"`
- Device-level SNMP set plus DB update run inside `withPduLock(pduId, ...)`

---

## Metrics Routes (`/api/pdus/:pduId`)

**Source:** `backend/src/routes/metrics.routes.ts`
**Prefix:** `/pdus/:pduId` (mounted under `/api`)

### `GET /api/pdus/:pduId/metrics`

Get historical power metrics for a PDU with optional date filtering.

| Param   | Type   | Validation  |
|---------|--------|-------------|
| `pduId` | string | UUID format |

**Query Parameters:**

| Param       | Type   | Default | Validation         |
|-------------|--------|---------|--------------------|
| `startDate` | string | -       | ISO 8601 date-time |
| `endDate`   | string | -       | ISO 8601 date-time |
| `limit`     | number | 100     | min: 1, max: 1000  |

**Response:** `PowerMetrics[]` (ordered by timestamp descending)

### `GET /api/pdus/:pduId/metrics/current`

Get current live power metrics from PDU via SNMP and store them.

| Param   | Type   | Validation  |
|---------|--------|-------------|
| `pduId` | string | UUID format |

**Response:**
```json
{
  "id": "uuid",
  "pduId": "uuid",
  "totalPowerDraw": 5.2,
  "totalPowerWatts": 1196,
  "voltage": 230,
  "loadState": "normal",
  "timestamp": "2026-02-09T00:00:00.000Z"
}
```

**Errors:** `404` PDU not found or no power monitoring, `500` SNMP failure

**Side Effects:** Inserts new record into `power_metrics` table

### `GET /api/pdus/:pduId/events`

Get events for a specific PDU.

| Param   | Type   | Validation  |
|---------|--------|-------------|
| `pduId` | string | UUID format |

**Query Parameters:**

| Param   | Type   | Default | Validation      |
|---------|--------|---------|-----------------|
| `limit` | number | 100     | min: 1, max: 500 |

**Response:** `PDUEvent[]` (ordered by timestamp descending)

---

## System Routes (`/api`)

**Source:** `backend/src/routes/system.routes.ts`
**Prefix:** None (mounted under `/api`)

### `GET /api/system/health`

Detailed system health with PDU and outlet statistics.

**Response:**
```json
{
  "totalPdus": 5,
  "activePdus": 4,
  "totalOutlets": 40,
  "stateSkewPercentage": 2.5,
  "averageResponseTime": 50,
  "lastSystemCheck": "2026-02-09T00:00:00.000Z"
}
```

### `GET /api/events`

Get all system events (across all PDUs) with PDU name joined.

**Query Parameters:**

| Param   | Type   | Default | Validation      |
|---------|--------|---------|-----------------|
| `limit` | number | 100     | min: 1, max: 500 |

**Response:** `Array<PDUEvent & { pduName: string }>` (ordered by timestamp descending)

### `GET /api/scheduled-operations`

List pending (unexecuted) scheduled operations.

**Query Parameters:**

| Param      | Type   | Description                  |
|------------|--------|------------------------------|
| `outletId` | string | UUID; filter by outlet       |

**Response:** `ScheduledOperation[]` (ordered by `scheduledTime`)

### `POST /api/scheduled-operations`

Create a new scheduled operation.

**Body Schema:**

| Field           | Type   | Required | Validation                     |
|-----------------|--------|----------|--------------------------------|
| `outletId`      | string | yes      | UUID format                    |
| `operation`     | string | yes      | `"on"`, `"off"`, `"reboot"`   |
| `scheduledTime` | string | yes      | ISO 8601 date-time format      |

**Response:** Created `ScheduledOperation` object

### `DELETE /api/scheduled-operations/:id`

Delete a scheduled operation.

| Param | Type   | Validation  |
|-------|--------|-------------|
| `id`  | string | UUID format |

**Response:** `{ success: true }`
**Error:** `404` `{ error: "Scheduled operation not found" }`

---

## API Keys Routes (`/api/api-keys`)

**Source:** `backend/src/routes/api-keys.routes.ts`
**Prefix:** `/api-keys` (mounted under `/api`)

### `GET /api/api-keys`

List all API keys. Does not expose full key values.

**Response:**
```json
[{
  "id": "uuid",
  "name": "My Key",
  "keyPreview": "abc12345",
  "isActive": true,
  "lastUsed": "2026-02-09T00:00:00.000Z",
  "createdAt": "2026-02-09T00:00:00.000Z"
}]
```

### `POST /api/api-keys`

Create a new API key. The full raw key is returned **only once** on creation.

**Body Schema:**

| Field  | Type   | Required | Validation                  |
|--------|--------|----------|-----------------------------|
| `name` | string | yes      | minLength: 1, maxLength: 100 |

**Response:**
```json
{
  "id": "uuid",
  "name": "My Key",
  "key": "full-raw-api-key-value",
  "keyPreview": "full-raw",
  "isActive": true,
  "createdAt": "2026-02-09T00:00:00.000Z"
}
```

**Side Effects:** Generates random key, stores hash (first 8 chars) and encrypted full key.

### `PUT /api/api-keys/:id`

Update API key name or active status.

| Param | Type   | Validation  |
|-------|--------|-------------|
| `id`  | string | UUID format |

**Body Schema:**

| Field      | Type    | Required |
|------------|---------|----------|
| `name`     | string  | no       |
| `isActive` | boolean | no       |

**Response:** Updated API key object (without full key)
**Error:** `404` `{ error: "API key not found" }`

### `DELETE /api/api-keys/:id`

Delete an API key permanently.

| Param | Type   | Validation  |
|-------|--------|-------------|
| `id`  | string | UUID format |

**Response:** `{ success: true }`
**Error:** `404` `{ error: "API key not found" }`

---

## M2M Routes (`/m2m`)

**Source:** `backend/src/routes/m2m.routes.ts`
**Prefix:** `/m2m` (mounted at root, **outside** `/api` group)
**Authentication:** All routes require `X-API-Key` header (via `m2mAuth` middleware)

### Authentication Middleware

**Source:** `backend/src/middleware/m2m-auth.ts`

The `m2mAuth` middleware uses Elysia's `.derive()` to:
1. Extract `X-API-Key` from request headers
2. Look up active keys by hash prefix (first 8 chars) for efficient DB query
3. Decrypt and compare full key for exact match
4. Update `lastUsed` timestamp (fire-and-forget)
5. Add `m2mAuthenticated`, `apiKeyId`, `apiKeyName` to request context

**Errors:** `401` if key missing or invalid.

### `GET /m2m/outlets/:outletId`

Get outlet state with PDU info.

| Param      | Type   | Validation  |
|------------|--------|-------------|
| `outletId` | string | UUID format |

**Response:**
```json
{
  "id": "uuid",
  "name": "Server 1",
  "outletNumber": 3,
  "state": "on",
  "desiredState": "on",
  "lastStateChange": "2026-02-09T00:00:00.000Z",
  "pdu": {
    "id": "uuid",
    "name": "PDU-Rack1",
    "ip": "10.0.0.1"
  }
}
```

`desiredState` is a legacy field name for the restore snapshot, not a user-managed target.

**Error:** `404` `{ error: "Outlet not found" }`

### `POST /m2m/outlets/:outletId/on`

Turn an outlet ON via SNMP. Logs to history with `initiatedBy: "m2m-api"`. Broadcasts WebSocket event `outlet:state-changed`.

| Param      | Type   | Validation  |
|------------|--------|-------------|
| `outletId` | string | UUID format |

**Success Response:**
```json
{
  "success": true,
  "outlet": { "id": "uuid", "name": "Server 1", "state": "on" }
}
```

**Error Response (500):** `{ success: false, error: "<message>" }`

### `POST /m2m/outlets/:outletId/off`

Turn an outlet OFF. Same behavior and response format as `/on`.

---

## Global Error Handling

Registered via `app.onError()`:

| Error Code   | HTTP Status | Response                                                          |
|--------------|-------------|-------------------------------------------------------------------|
| `VALIDATION` | 400         | `{ error: "Validation Error", message: "<details>" }`            |
| `NOT_FOUND`  | 404         | `{ error: "Not Found", message: "The requested resource was not found" }` |
| Other        | 500         | `{ error: "Internal Server Error", message: "<details in dev>" }` |

In production (`NODE_ENV !== 'development'`), internal error details are hidden.

---

## WebSocket Events

Events broadcast by route handlers via `WebSocketService.getInstance().broadcast()`:

| Event                    | Trigger                          | Payload                                               |
|--------------------------|----------------------------------|-------------------------------------------------------|
| `outlet:state-changed`   | Single outlet power change       | `{ pduId, outletId, outletNumber, newState }`         |
| `outlets:reordered`      | Outlet reorder or reset-order    | `{ pduId, outlets: Outlet[] }`                        |
| `outlets:bulk-changed`   | Bulk power operation             | `{ pduId, operation }`                                |

---

## Dependency Injection

Services are injected into route handlers via Elysia's `.decorate()`:

| Key             | Type           | Description                      |
|-----------------|----------------|----------------------------------|
| `db`            | DrizzleDB      | Database connection               |
| `snmpService`   | SNMPService    | SNMP communication service        |
| `stateManager`  | StateManager   | Outlet snapshot capture and power-loss restore |
