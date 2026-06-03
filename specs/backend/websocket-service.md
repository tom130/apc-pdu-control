# WebSocket Service Spec

**File:** `backend/src/services/websocket.service.ts`

## Purpose

Manages real-time WebSocket connections for pushing PDU status updates, outlet state changes, and metrics to connected browser clients. Built for the Elysia framework's WebSocket handler interface.

## Exports

### Class: `WebSocketService` (Singleton)

```typescript
WebSocketService.getInstance(): WebSocketService
```

### Object: `websocketHandler`

Elysia-compatible WebSocket handler with `open`, `message`, `close`, and `error` callbacks.

## Interfaces

```typescript
interface WebSocketClient {
  id: string;           // UUID assigned on connection
  ws: any;              // Raw WebSocket instance
  subscriptions: Set<string>; // Channel subscriptions (always includes 'global')
}
```

## Public API

| Method | Signature | Description |
|--------|-----------|-------------|
| `addClient` | `(id: string, ws: any) => void` | Registers a new client with default `'global'` subscription. |
| `removeClient` | `(id: string) => void` | Removes a client from the connection pool. |
| `subscribe` | `(clientId: string, channel: string) => void` | Adds a channel subscription for a client. |
| `unsubscribe` | `(clientId: string, channel: string) => void` | Removes a channel subscription for a client. |
| `broadcast` | `(event: string, data: any, channel?: string) => void` | Sends a message to all clients subscribed to the given channel (default: `'global'`). |
| `sendToClient` | `(clientId: string, event: string, data: any) => void` | Sends a message to a specific client by ID. |

## Message Format

### Outgoing Messages (broadcast / sendToClient)

```json
{
  "type": "<event-name>",
  "channel": "<channel>",   // Only present in broadcast messages
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Connection Acknowledgment (on open)

```json
{
  "type": "connected",
  "clientId": "<uuid>",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Ping/Pong

```json
// Client sends:
{ "type": "ping" }

// Server responds:
{ "type": "pong", "timestamp": "2024-01-01T00:00:00.000Z" }
```

## Inbound Message Types

| Type | Payload | Behavior |
|------|---------|----------|
| `subscribe` | `{ type: "subscribe", channel: "<name>" }` | Adds the channel to the client's subscription set. |
| `unsubscribe` | `{ type: "unsubscribe", channel: "<name>" }` | Removes the channel from the client's subscription set. |
| `ping` | `{ type: "ping" }` | Responds with a `pong` message containing a timestamp. |
| *(other)* | Any | Logged at debug level, no action taken. |

## Channel System

- Every client automatically subscribes to `'global'` on connection
- Clients can subscribe to additional channels (e.g., `pdu:<id>`)
- `broadcast()` delivers to clients subscribed to the specified channel **OR** to `'global'`
  - This means `'global'` subscribers receive **all** broadcasts regardless of channel
- Channels are string-based with no predefined validation

### Known Channels Used by Other Services

| Channel Pattern | Used By | Events |
|-----------------|---------|--------|
| `global` | Default | All broadcasts |
| `pdu:<pduId>` | SchedulerService | `pdu:status-update`, `metrics:updated` |

### Known Event Types

| Event | Source | Data Shape |
|-------|--------|------------|
| `pdu:status-update` | SchedulerService (poll) | `{ pduId, status, outletStates?, lastSeen?, error? }`; online/offline status changes are backed by edge-only `connection_restored`/`connection_lost` database events |
| `metrics:updated` | SchedulerService (metrics) | `{ pduId, metrics, timestamp }` |
| `outlet:state-changed` | Outlet control or StateManager restore | `{ pduId, outletId, outletNumber, newState }` |
| `outlet:scheduled-operation` | SchedulerService | `{ outletId, outletNumber, operation, success, error? }` |
| `outlets:bulk-changed` | Outlet bulk control | `{ pduId, operation, count }` |
| `outlets:reordered` | Outlet reorder routes | `{ pduId }` |

Power-loss restore completion is persisted as a `recovery_complete` PDU event and exposed through the events API. The frontend also accepts a `pdu:restore-complete` WebSocket event if a future backend emits it directly.

## WebSocket Handler (Elysia Integration)

The `websocketHandler` object is designed to be used with Elysia's `.ws()` route:

| Callback | Behavior |
|----------|----------|
| `open(ws)` | Generates UUID, stores as `ws.data.clientId`, registers client, sends `connected` ack. |
| `message(ws, message)` | Parses JSON (string or object), routes by `type` field. |
| `close(ws)` | Removes client from pool using `ws.data.clientId`. |
| `error(ws, error)` | Logs error with client ID context. |

## Connection Lifecycle

```
Client connects
  -> open(): assign UUID, register in clients Map, send 'connected' ack
  -> message(): handle subscribe/unsubscribe/ping
  -> (server pushes events via broadcast/sendToClient)
  -> close(): remove from clients Map
```

## Error Handling

- `broadcast()`: Catches per-client send errors; continues sending to remaining clients
- `sendToClient()`: Catches send errors; logs but does not propagate
- `message()`: Catches JSON parse errors; logs but does not disconnect client
- No reconnection logic on the server side (client responsibility)

## Dependencies

- `logger` from `../utils/logger`
- `crypto.randomUUID()` (Web Crypto API) for client ID generation
- No external WebSocket library (uses Elysia's built-in WebSocket support)

## Configuration

No environment variables. All behavior is hardcoded.
