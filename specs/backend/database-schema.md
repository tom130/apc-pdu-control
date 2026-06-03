# Database Schema Spec

## Overview

The APC PDU Control system uses **PostgreSQL** with **Drizzle ORM** for schema definition and migrations. The database stores PDU configurations, outlet states, power metrics, event logs, scheduled operations, and API keys for M2M authentication.

**ORM:** Drizzle ORM (`drizzle-orm/postgres-js`)
**Driver:** `postgres` (postgres.js)
**Schema definition:** `backend/src/db/schema.ts`
**Fresh-install SQL artifact:** `backend/database/schema.sql` (kept in parity with the Drizzle schema)
**Migration folder:** `backend/drizzle/`

---

## Database Connection

**Source:** `backend/src/db/index.ts`

Two separate connections are maintained:

| Connection       | Purpose          | Config                     |
|------------------|------------------|----------------------------|
| `queryClient`    | Runtime queries  | Default pool settings      |
| `migrationClient`| Running migrations | `max: 1` (single connection) |

**Configuration:** `DATABASE_URL` environment variable (required).

**Exports:**
- `db` - Drizzle instance for queries
- `migrationDb` - Drizzle instance for migrations
- All schema re-exports via `export * from './schema'`

---

## Migration System

**Source:** `backend/src/db/migrate.ts`

Standalone script that runs Drizzle migrations from the `./drizzle` folder using a single-connection client.
Docker fresh installs bootstrap from `backend/database/schema.sql`; that artifact is regenerated to match `backend/src/db/schema.ts` and is covered by `backend/src/db/__tests__/schema-parity.test.ts`.

### Migration History

**Journal:** `backend/drizzle/meta/_journal.json`

| Migration | Tag | Description |
|-----------|-----|-------------|
| `0000` | `daily_dreaming_celestial` | Initial schema - all base tables (pdus, outlets, outlet_state_history, pdu_events, power_metrics, scheduled_operations) with indexes and foreign keys |
| `0001` | `yellow_hercules` | Add `api_keys` table for M2M authentication with key_hash and encrypted_key columns, plus indexes |

---

## Tables

### `pdus`

Stores PDU (Power Distribution Unit) configurations including SNMP connection details.

| Column                | Type                       | Nullable | Default              | Notes                    |
|-----------------------|----------------------------|----------|----------------------|--------------------------|
| `id`                  | `uuid`                     | no       | `gen_random_uuid()`  | Primary key              |
| `name`                | `text`                     | no       |                      |                          |
| `ip_address`          | `text`                     | no       |                      | Unique constraint        |
| `model`               | `text`                     | yes      |                      | PDU model identifier     |
| `snmp_version`        | `text`                     | yes      | `'v3'`               | `v1`, `v2c`, or `v3`    |
| `snmp_user`           | `text`                     | yes      |                      | SNMPv3 username          |
| `snmp_auth_protocol`  | `text`                     | yes      |                      | e.g., `SHA`, `MD5`      |
| `snmp_auth_passphrase`| `text`                     | yes      |                      | Encrypted at rest        |
| `snmp_priv_protocol`  | `text`                     | yes      |                      | e.g., `AES`, `DES`      |
| `snmp_priv_passphrase`| `text`                     | yes      |                      | Encrypted at rest        |
| `snmp_security_level` | `text`                     | yes      |                      | `noAuthNoPriv`, `authNoPriv`, `authPriv` |
| `is_active`           | `boolean`                  | yes      | `true`               |                          |
| `last_seen`           | `timestamp with time zone` | yes      |                      | Last successful contact  |
| `created_at`          | `timestamp with time zone` | yes      | `now()`              |                          |
| `updated_at`          | `timestamp with time zone` | yes      | `now()`              |                          |

**Indexes:**
- `idx_pdus_ip_address` on `ip_address`
- `idx_pdus_is_active` on `is_active`

**Constraints:**
- `pdus_ip_address_unique` - unique on `ip_address`

---

### `outlets`

Stores individual outlet configurations and state within a PDU.

| Column             | Type                       | Nullable | Default              | Notes                     |
|--------------------|----------------------------|----------|----------------------|---------------------------|
| `id`               | `uuid`                     | no       | `gen_random_uuid()`  | Primary key               |
| `pdu_id`           | `uuid`                     | no       |                      | FK to `pdus.id`           |
| `outlet_number`    | `integer`                  | no       |                      | Physical outlet number    |
| `name`             | `text`                     | yes      |                      | User-assigned name        |
| `description`      | `text`                     | yes      |                      |                           |
| `display_order`    | `integer`                  | yes      |                      | UI sort order             |
| `desired_state`    | `text`                     | yes      |                      | Restore snapshot: `on`, `off`, or `null`; legacy column name |
| `actual_state`     | `text`                     | yes      |                      | Last observed state; persisted as `on` or `off` (`reboot` maps to `on`) |
| `last_state_change`| `timestamp with time zone` | yes      |                      |                           |
| `is_critical`      | `boolean`                  | yes      | `false`              | Marks critical outlets    |
| `auto_recovery`    | `boolean`                  | yes      | `true`               | Auto-restore on reboot    |
| `created_at`       | `timestamp with time zone` | yes      | `now()`              |                           |
| `updated_at`       | `timestamp with time zone` | yes      | `now()`              |                           |

**Indexes:**
- `unique_pdu_outlet` (unique) on `(pdu_id, outlet_number)`
- `idx_outlets_pdu_id` on `pdu_id`
- `idx_outlets_desired_state` on `desired_state`
- `idx_outlets_actual_state` on `actual_state`
- `idx_outlets_display_order` on `(pdu_id, display_order)`

Startup backfill initializes missing restore snapshots with:

```sql
UPDATE outlets
SET desired_state = actual_state
WHERE desired_state IS NULL
  AND actual_state IS NOT NULL;
```

**Foreign Keys:**
- `pdu_id` -> `pdus.id` ON DELETE CASCADE

---

### `outlet_state_history`

Audit log of outlet state changes (both successful and failed).

| Column          | Type                       | Nullable | Default              | Notes                       |
|-----------------|----------------------------|----------|----------------------|-----------------------------|
| `id`            | `uuid`                     | no       | `gen_random_uuid()`  | Primary key                 |
| `outlet_id`     | `uuid`                     | no       |                      | FK to `outlets.id`          |
| `previous_state`| `text`                     | yes      |                      | State before change         |
| `new_state`     | `text`                     | yes      |                      | Target state                |
| `change_type`   | `text`                     | yes      |                      | `manual`, `auto_recovery`, `pdu_reboot`, `sync` |
| `initiated_by`  | `text`                     | yes      |                      | `user`, `m2m-api`, `system` |
| `timestamp`     | `timestamp with time zone` | yes      | `now()`              |                             |
| `success`       | `boolean`                  | yes      | `false`              | Whether change succeeded    |
| `error_message` | `text`                     | yes      |                      | Error details on failure    |

**Indexes:**
- `idx_outlet_state_history_outlet_id` on `outlet_id`
- `idx_outlet_state_history_timestamp` on `timestamp`

**Foreign Keys:**
- `outlet_id` -> `outlets.id` ON DELETE CASCADE

---

### `pdu_events`

System events related to PDUs (connection issues, restore completion, and load warnings).

| Column       | Type                       | Nullable | Default              | Notes                    |
|--------------|----------------------------|----------|----------------------|--------------------------|
| `id`         | `uuid`                     | no       | `gen_random_uuid()`  | Primary key              |
| `pdu_id`     | `uuid`                     | no       |                      | FK to `pdus.id`          |
| `event_type` | `text`                     | no       |                      | `reboot`, `connection_lost`, `connection_restored`, `recovery_complete`, `state_skew` |
| `description`| `text`                     | yes      |                      | Human-readable message   |
| `metadata`   | `jsonb`                    | yes      |                      | Arbitrary event data     |
| `timestamp`  | `timestamp with time zone` | yes      | `now()`              |                          |

**Indexes:**
- `idx_pdu_events_pdu_id` on `pdu_id`
- `idx_pdu_events_timestamp` on `timestamp`

**Foreign Keys:**
- `pdu_id` -> `pdus.id` ON DELETE CASCADE

---

### `power_metrics`

Time-series power consumption data for PDUs.

| Column             | Type                       | Nullable | Default              | Notes                |
|--------------------|----------------------------|----------|----------------------|----------------------|
| `id`               | `uuid`                     | no       | `gen_random_uuid()`  | Primary key          |
| `pdu_id`           | `uuid`                     | no       |                      | FK to `pdus.id`      |
| `total_power_draw` | `decimal(10,2)`            | yes      |                      | Amperes              |
| `total_power_watts`| `integer`                  | yes      |                      | Watts (230V * Amps)  |
| `voltage`          | `integer`                  | yes      | `230`                | EU standard voltage  |
| `load_state`       | `text`                     | yes      |                      | `normal`, `low`, `near_overload`, `overload` |
| `timestamp`        | `timestamp with time zone` | yes      | `now()`              |                      |

**Indexes:**
- `idx_power_metrics_pdu_id` on `pdu_id`
- `idx_power_metrics_timestamp` on `timestamp`

**Foreign Keys:**
- `pdu_id` -> `pdus.id` ON DELETE CASCADE

---

### `scheduled_operations`

Pending operations to be executed at a future time.

| Column          | Type                       | Nullable | Default              | Notes                 |
|-----------------|----------------------------|----------|----------------------|-----------------------|
| `id`            | `uuid`                     | no       | `gen_random_uuid()`  | Primary key           |
| `outlet_id`     | `uuid`                     | no       |                      | FK to `outlets.id`    |
| `operation`     | `text`                     | no       |                      | `on`, `off`, `reboot` |
| `scheduled_time`| `timestamp with time zone` | no       |                      | When to execute       |
| `executed`      | `boolean`                  | yes      | `false`              | Execution flag        |
| `executed_at`   | `timestamp with time zone` | yes      |                      | When actually run     |
| `created_at`    | `timestamp with time zone` | yes      | `now()`              |                       |

**Indexes:**
- `idx_scheduled_operations_outlet_id` on `outlet_id`
- `idx_scheduled_operations_scheduled_time` on `scheduled_time`
- `idx_scheduled_operations_executed` on `executed`

**Foreign Keys:**
- `outlet_id` -> `outlets.id` ON DELETE CASCADE

---

### `cron_schedules`

Stores recurring CRON-based outlet operations.

| Column          | Type                       | Nullable | Default              | Notes                 |
|-----------------|----------------------------|----------|----------------------|-----------------------|
| `id`            | `uuid`                     | no       | `gen_random_uuid()`  | Primary key           |
| `outlet_id`     | `uuid`                     | no       |                      | FK to `outlets.id`    |
| `name`          | `text`                     | no       |                      | Schedule label        |
| `cron_expression` | `text`                   | no       |                      | CRON expression       |
| `operation`     | `text`                     | no       |                      | `on`, `off`, `reboot` |
| `is_active`     | `boolean`                  | yes      | `true`               | Whether schedule runs |
| `last_executed_at` | `timestamp with time zone` | yes   |                      | Previous run time     |
| `next_run_at`   | `timestamp with time zone` | yes      |                      | Next due time         |
| `created_at`    | `timestamp with time zone` | yes      | `now()`              |                       |
| `updated_at`    | `timestamp with time zone` | yes      | `now()`              |                       |

**Indexes:**
- `idx_cron_schedules_outlet_id` on `outlet_id`
- `idx_cron_schedules_is_active` on `is_active`
- `idx_cron_schedules_next_run_at` on `next_run_at`

**Foreign Keys:**
- `outlet_id` -> `outlets.id` ON DELETE CASCADE

---

### `api_keys`

Stores M2M API keys for machine-to-machine authentication.

| Column          | Type                       | Nullable | Default              | Notes                        |
|-----------------|----------------------------|----------|----------------------|------------------------------|
| `id`            | `uuid`                     | no       | `gen_random_uuid()`  | Primary key                  |
| `name`          | `text`                     | no       |                      | Human-readable key name      |
| `key_hash`      | `text`                     | no       |                      | First 8 chars for lookup     |
| `encrypted_key` | `text`                     | no       |                      | Full key, encrypted          |
| `is_active`     | `boolean`                  | yes      | `true`               | Enable/disable key           |
| `last_used`     | `timestamp with time zone` | yes      |                      | Last authentication time     |
| `created_at`    | `timestamp with time zone` | yes      | `now()`              |                              |
| `updated_at`    | `timestamp with time zone` | yes      | `now()`              |                              |

**Indexes:**
- `idx_api_keys_key_hash` on `key_hash`
- `idx_api_keys_is_active` on `is_active`

**Added in migration:** `0001_yellow_hercules`

---

## Entity Relationships

```
pdus (1) ──────< outlets (many)
  │                 │
  │                 ├──< outlet_state_history (many)
  │                 │
  │                 ├──< scheduled_operations (many)
  │                 │
  │                 └──< cron_schedules (many)
  │
  ├──< pdu_events (many)
  │
  └──< power_metrics (many)

api_keys (standalone)
```

### Drizzle Relations

Defined in `backend/src/db/schema.ts`:

| Parent Table   | Relation     | Child Table             | Type     |
|---------------|--------------|-------------------------|----------|
| `pdus`        | `outlets`    | `outlets`               | one-many |
| `pdus`        | `events`     | `pdu_events`            | one-many |
| `pdus`        | `metrics`    | `power_metrics`         | one-many |
| `outlets`     | `pdu`        | `pdus`                  | many-one |
| `outlets`     | `stateHistory`| `outlet_state_history` | one-many |
| `outlets`     | `scheduledOperations` | `scheduled_operations` | one-many |
| `outlets`     | `cronSchedules` | `cron_schedules` | one-many |

All foreign keys use `ON DELETE CASCADE` - deleting a PDU removes all related outlets, events, metrics, and transitively all outlet history and scheduled operations.

---

## Exported TypeScript Types

```typescript
type PDU = typeof pdus.$inferSelect;
type NewPDU = typeof pdus.$inferInsert;
type Outlet = typeof outlets.$inferSelect;
type NewOutlet = typeof outlets.$inferInsert;
type OutletStateHistory = typeof outletStateHistory.$inferSelect;
type NewOutletStateHistory = typeof outletStateHistory.$inferInsert;
type PDUEvent = typeof pduEvents.$inferSelect;
type NewPDUEvent = typeof pduEvents.$inferInsert;
type PowerMetrics = typeof powerMetrics.$inferSelect;
type NewPowerMetrics = typeof powerMetrics.$inferInsert;
type ScheduledOperation = typeof scheduledOperations.$inferSelect;
type NewScheduledOperation = typeof scheduledOperations.$inferInsert;
type ApiKey = typeof apiKeys.$inferSelect;
type NewApiKey = typeof apiKeys.$inferInsert;
```

---

## Schema Parity

`backend/src/db/schema.ts` is the TypeScript source of truth, and `backend/database/schema.sql` is the Docker fresh-install artifact. They must stay aligned for code-referenced tables and columns, including:

- `pdu_events.description` and `pdu_events.metadata`
- `power_metrics.total_power_watts` and `power_metrics.voltage`
- `scheduled_operations.executed_at`
- `cron_schedules`
- `api_keys`

`backend/src/db/__tests__/schema-parity.test.ts` verifies the fresh-install artifact contains those tables/columns and does not reintroduce the old drifted columns (`event_data`, `severity`, `execution_time`).
