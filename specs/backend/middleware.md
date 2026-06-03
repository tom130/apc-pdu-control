# Middleware and Utilities Spec

## M2M Authentication Middleware

**File:** `backend/src/middleware/m2m-auth.ts`

### Purpose

Elysia plugin that authenticates machine-to-machine API requests using database-backed API keys sent in the `x-api-key` header.

### Export

```typescript
export const m2mAuth: Elysia
```

An Elysia plugin (named `'m2m-auth'`) that uses `.derive()` to add authentication context to the request.

### Authentication Flow

```
Request with x-api-key header
  -> Extract API key from header
  -> Hash prefix = first 8 chars of the key
  -> Query apiKeys table WHERE keyHash = prefix AND isActive = true
  -> For each matching row:
       -> decrypt(encryptedKey)
       -> Compare decrypted key with provided key
  -> If match found:
       -> Fire-and-forget: UPDATE lastUsed timestamp
       -> Return { m2mAuthenticated: true, apiKeyId, apiKeyName }
  -> If no match: throw 401
```

### Derived Context

When authentication succeeds, the following properties are added to the request context:

| Property | Type | Description |
|----------|------|-------------|
| `m2mAuthenticated` | `boolean` | Always `true` when middleware passes |
| `apiKeyId` | `string` | UUID of the matched API key record |
| `apiKeyName` | `string` | Human-readable name of the API key |

### Error Responses

| Condition | HTTP Status | Message |
|-----------|-------------|---------|
| No `x-api-key` header | 401 | `"API key required"` |
| No matching valid key | 401 | `"Invalid API key"` |

### Key Lookup Strategy

- Uses an 8-character prefix hash (`keyHash`) for efficient database filtering
- Full key verification requires decrypting each candidate and comparing
- Decryption failures for individual keys are logged and skipped (does not fail the request)

### Dependencies

- `Elysia` framework
- `apiKeys` table from `../db/schema`
- `decrypt` from `../utils/crypto`
- `logger` from `../utils/logger`
- Expects `db` (Drizzle database instance) to be available in the Elysia context

---

## Crypto Utilities

**File:** `backend/src/utils/crypto.ts`

### Purpose

Provides AES-256-GCM encryption/decryption for sensitive data (SNMP passphrases, API keys) and password hashing utilities.

### Exports

| Function | Signature | Description |
|----------|-----------|-------------|
| `encrypt` | `(text: string) => string` | Encrypts plaintext using AES-256-GCM. Returns `"iv:authTag:ciphertext"` in hex. |
| `decrypt` | `(encryptedData: string) => string` | Decrypts the colon-delimited encrypted string back to plaintext. |
| `generateApiKey` | `() => string` | Generates 32 random bytes as a 64-character hex string. |
| `hashPassword` | `(password: string) => string` | Hashes a password using Bun's built-in bcrypt (`Bun.password.hashSync`). |
| `verifyPassword` | `(password: string, hash: string) => boolean` | Verifies a password against a bcrypt hash (`Bun.password.verifySync`). |

### Encryption Details

| Parameter | Value |
|-----------|-------|
| Algorithm | `aes-256-gcm` |
| Key derivation | `scryptSync(ENCRYPTION_KEY, 'salt', 32)` |
| IV | 16 random bytes per encryption |
| Auth tag | GCM authentication tag (integrity verification) |
| Output format | `"<iv_hex>:<authTag_hex>:<ciphertext_hex>"` |

### Configuration

| Env Var | Required | Description |
|---------|----------|-------------|
| `ENCRYPTION_KEY` | Yes | Must be exactly 32 characters. Used as input to scrypt key derivation. |

### Error Handling

- `getKey()` throws if `ENCRYPTION_KEY` is not set or not exactly 32 characters
- `decrypt()` throws if input is not in `"iv:authTag:ciphertext"` format
- `decrypt()` throws if the auth tag doesn't match (tampered data)

### Dependencies

- Node.js `crypto` module (`createCipheriv`, `createDecipheriv`, `randomBytes`, `scryptSync`)
- `Bun.password` for bcrypt operations

---

## Logger

**File:** `backend/src/utils/logger.ts`

### Purpose

Application-wide structured JSON logger.

### Export

```typescript
export const logger: pino.Logger
```

### Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `LOG_LEVEL` | `'info'` | Minimum log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |

### Behavior

- Uses `pino` for structured JSON logging
- Custom level formatter: outputs `{ level: "info" }` instead of numeric level
- Shared singleton instance used across all services

### Usage Pattern

```typescript
logger.info({ pdu: pdu.name, outlet: 3 }, 'Outlet state changed');
logger.error({ error: err.message, stack: err.stack }, 'SNMP connection failed');
logger.debug({ count: 5 }, 'Polling active PDUs');
```

### Dependencies

- `pino` logging library

---

## Constants

**File:** `backend/src/utils/constants.ts`

### Purpose

Centralizes SNMP OID definitions, command values, state mappings, type definitions, and polling intervals.

### Exports

#### SNMP_OIDS

APC-specific MIB OIDs organized by function:

| Category | OIDs |
|----------|------|
| PDU Identification | `rPDUIdentName`, `rPDUIdentHardwareRev`, `rPDUIdentFirmwareRev`, `rPDUIdentModelNumber`, `rPDUIdentSerialNumber` |
| Device Commands | `rPDUOutletDevCommand` |
| Outlet Control (2G) | `rPDUOutletControlOutletCommand` |
| Outlet Control (1G) | `rPDUOutletControlOutletCommandOld` |
| Outlet Status (2G) | `rPDUOutletStatusIndex`, `rPDUOutletStatusOutletName`, `rPDUOutletStatusOutletState` |
| Outlet Status (1G) | `rPDUOutletStatusOutletNameOld`, `rPDUOutletStatusOutletStateOld` |
| Power Monitoring (2G) | `rPDULoadStatusLoad`, `rPDULoadStatusLoadState` |
| Power Monitoring (Indexed) | `rPDULoadStatusLoadIndexed`, `rPDULoadStatusLoadStateIndexed` |
| Power Monitoring (1G) | `rPDULoadPhaseStatusCurrent`, `rPDULoadPhaseStatusLoadState` |

All OIDs are under APC's enterprise prefix: `1.3.6.1.4.1.318.1.1.*`

#### SNMP_COMMANDS

| Category | Command | Value |
|----------|---------|-------|
| OUTLET | ON | 1 |
| OUTLET | OFF | 2 |
| OUTLET | REBOOT | 3 |
| DEVICE | ON_ALL | 2 |
| DEVICE | OFF_ALL | 3 |
| DEVICE | REBOOT_ALL | 4 |

#### SNMP_STATE_MAP

| Category | SNMP Value | Mapped State |
|----------|------------|--------------|
| OUTLET | 1 | `'on'` |
| OUTLET | 2 | `'off'` |
| OUTLET | 3 | `'reboot'` |
| LOAD | 1 | `'normal'` |
| LOAD | 2 | `'low'` |
| LOAD | 3 | `'near_overload'` |
| LOAD | 4 | `'overload'` |

#### Type Definitions

```typescript
type OutletState = 'on' | 'off' | 'reboot';
type LoadState = 'normal' | 'low' | 'near_overload' | 'overload';
type ChangeType = 'manual' | 'auto_recovery' | 'pdu_reboot' | 'sync' | 'scheduled';
type EventType = 'reboot' | 'connection_lost' | 'connection_restored' | 'recovery_complete' | 'state_skew';
```

#### INTERVALS

| Constant | Default | Env Var | Description |
|----------|---------|---------|-------------|
| `POLL` | 30000ms | `POLL_INTERVAL` | PDU outlet state polling |
| `METRICS` | 300000ms | `METRICS_INTERVAL` | Power metrics collection |
| `SCHEDULE_CHECK` | 60000ms | `SCHEDULE_CHECK_INTERVAL` | One-time and cron schedule checks |
