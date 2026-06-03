# Application Entry Point Spec

## Overview

The backend application entry point (`backend/src/index.ts`) bootstraps an Elysia HTTP server with SNMP-based PDU management capabilities, WebSocket real-time updates, background scheduling, and Prometheus metrics.

**Runtime:** Bun
**Framework:** Elysia (Bun-native HTTP framework)

---

## Configuration

| Environment Variable    | Default     | Description                          |
|------------------------|-------------|--------------------------------------|
| `PORT`                 | `3001`      | HTTP server port                     |
| `HOST`                 | `0.0.0.0`  | HTTP server bind address             |
| `DATABASE_URL`         | (required)  | PostgreSQL connection string         |
| `NODE_ENV`             | -           | `development` enables verbose errors |
| `PROMETHEUS_ENABLED`   | -           | Set to `false` to disable `/metrics` |

---

## Startup Sequence

```
1. Import dependencies and modules
2. Initialize services:
   a. SNMPService (new instance)
   b. StateManager (depends on db + SNMPService)
   c. SchedulerService (depends on db + SNMPService + StateManager)
3. Build Elysia app:
   a. Register plugins (CORS, Swagger)
   b. Register WebSocket handler at /ws
   c. Decorate context with db, snmpService, stateManager
   d. Register top-level routes (/health, /metrics)
   e. Register API route group (/api/*)
   f. Register M2M routes (/m2m/*)
   g. Register global error handler
4. Start HTTP listener on HOST:PORT
5. Run `backfillSnapshot(db)` to initialize missing restore snapshots from existing `actual_state` values
6. Start SchedulerService background tasks
7. Register shutdown signal handlers (SIGTERM, SIGINT)
```

---

## Plugin Registration

| Plugin  | Configuration                                      | Purpose                    |
|---------|---------------------------------------------------|----------------------------|
| `cors`  | `{ origin: true, credentials: true }`             | Allow all origins with cookies |
| `swagger` | `{ info: { title: 'APC PDU API', version: '1.0.0' } }` | Auto-generated API docs at `/swagger` |

---

## Middleware Chain

### Context Decoration

Services injected into all route handlers via `.decorate()`:

| Key             | Type           | Description                                |
|-----------------|----------------|--------------------------------------------|
| `db`            | DrizzleDB      | PostgreSQL connection (from `./db`)         |
| `snmpService`   | SNMPService    | SNMP communication for PDU control          |
| `stateManager`  | StateManager   | Outlet snapshot capture and power-loss restore |

### M2M Authentication Middleware

The `m2mAuth` middleware (applied only to `/m2m` routes) uses `.derive()` to:
1. Extract `X-API-Key` header
2. Validate against database (hash prefix lookup + full key decryption)
3. Add `m2mAuthenticated`, `apiKeyId`, `apiKeyName` to context

### Global Error Handler

Registered via `.onError()`, handles three error categories:

| Code         | HTTP Status | Behavior                                |
|--------------|-------------|-----------------------------------------|
| `VALIDATION` | 400         | Returns validation error details        |
| `NOT_FOUND`  | 404         | Generic not-found message               |
| Other        | 500         | Full details in dev, generic in prod    |

---

## Route Mounting

```
/
├── GET  /health              (top-level health check)
├── GET  /metrics             (Prometheus metrics)
├── WS   /ws                  (WebSocket)
├── /api                      (route group)
│   ├── /pdus                 (pduRoutes)
│   │   ├── GET    /
│   │   ├── GET    /:pduId
│   │   ├── POST   /
│   │   ├── PUT    /:pduId
│   │   ├── DELETE /:pduId
│   │   └── POST   /:pduId/test
│   ├── /pdus/:pduId/outlets  (outletRoutes)
│   │   ├── GET    /
│   │   ├── GET    /:outletId
│   │   ├── PUT    /:outletId
│   │   ├── POST   /:outletId/power
│   │   ├── GET    /:outletId/history
│   │   ├── PUT    /reorder
│   │   ├── PUT    /reset-order
│   │   └── POST   /bulk
│   ├── /pdus/:pduId          (metricsRoutes)
│   │   ├── GET    /metrics
│   │   ├── GET    /metrics/current
│   │   └── GET    /events
│   ├── /system/health        (systemRoutes)
│   ├── /events               (systemRoutes)
│   ├── /scheduled-operations (systemRoutes)
│   │   ├── GET    /
│   │   ├── POST   /
│   │   └── DELETE /:id
│   └── /api-keys             (apiKeysRoutes)
│       ├── GET    /
│       ├── POST   /
│       ├── PUT    /:id
│       └── DELETE /:id
└── /m2m                      (m2mRoutes - with auth middleware)
    ├── GET    /outlets/:outletId
    ├── POST   /outlets/:outletId/on
    └── POST   /outlets/:outletId/off
```

---

## Service Dependencies

```
index.ts
├── db (./db)                          → PostgreSQL via Drizzle
├── SNMPService (./services/snmp.service)  → SNMP communication
├── StateManager (./services/state-manager.service)
│   ├── depends on: db
│   └── depends on: SNMPService
├── SchedulerService (./services/scheduler.service)
│   ├── depends on: db
│   ├── depends on: SNMPService
│   └── depends on: StateManager
├── WebSocketService (./services/websocket.service)  → Singleton
├── PrometheusService (./services/prometheus.service) → Lazy-loaded singleton
└── logger (./utils/logger)
```

---

## Background Services

### SchedulerService

Started after HTTP listener with `schedulerService.start()`. Handles:
- Execution of scheduled power operations
- Periodic state polling and power metrics collection

Before the scheduler starts, `backfillSnapshot(db)` runs once:
- Updates `desired_state = actual_state` where `desired_state IS NULL AND actual_state IS NOT NULL`
- Logs the number of rows updated
- Logs and continues if the backfill fails

Stopped during graceful shutdown with `schedulerService.stop()`.

---

## Graceful Shutdown

Both `SIGTERM` and `SIGINT` signals trigger:

```
1. Log shutdown message
2. schedulerService.stop()    → Stop background tasks
3. app.stop()                 → Close HTTP server
4. process.exit(0)
```

---

## Test Server

**Source:** `backend/src/test-server.ts`

Minimal Elysia server for testing connectivity. Exposes only `GET /health` on port 3001. No database, SNMP, or route dependencies.

```typescript
// Returns: { status: 'ok' }
GET /health
```
