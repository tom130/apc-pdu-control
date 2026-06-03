# Prometheus Service Spec

**File:** `backend/src/services/prometheus.service.ts`

## Purpose

Collects and exposes PDU operational metrics in Prometheus exposition format. Tracks power consumption, outlet states, PDU connectivity, SNMP request latency, polling performance, and error rates.

## Exports

### Class: `PrometheusService` (Singleton)

```typescript
PrometheusService.getInstance(): PrometheusService
```

Private constructor; accessed exclusively via `getInstance()`.

## Metrics

### Power Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `pdu_power_draw_amperes` | Gauge | `pdu_name`, `pdu_id`, `pdu_ip` | Current power draw in Amperes |
| `pdu_power_consumption_watts` | Gauge | `pdu_name`, `pdu_id`, `pdu_ip` | Current power consumption in Watts |
| `pdu_voltage_volts` | Gauge | `pdu_name`, `pdu_id`, `pdu_ip` | Current voltage in Volts |
| `pdu_load_state` | Gauge | `pdu_name`, `pdu_id`, `pdu_ip`, `state_name` | Numeric load state (0=normal, 1=low, 2=near_overload, 3=overload) |

### Outlet Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `pdu_outlet_state` | Gauge | `pdu_name`, `pdu_id`, `pdu_ip`, `outlet_name`, `outlet_number` | Outlet state (0=off, 1=on, 2=reboot) |

### PDU Status Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `pdu_status` | Gauge | `pdu_name`, `pdu_id`, `pdu_ip` | Online status (0=offline, 1=online) |
| `pdu_last_seen_timestamp` | Gauge | `pdu_name`, `pdu_id`, `pdu_ip` | Last seen as Unix epoch seconds |

### System Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `pdu_state_changes_total` | Counter | `pdu_name`, `pdu_id`, `outlet_name`, `outlet_number`, `change_type`, `from_state`, `to_state` | Total outlet state changes |
| `pdu_errors_total` | Counter | `pdu_name`, `pdu_id`, `error_type`, `operation` | Total errors by type and operation |
| `pdu_snmp_request_duration_seconds` | Histogram | `pdu_name`, `pdu_id`, `operation` | SNMP request latency. Buckets: 0.1, 0.5, 1, 2, 5, 10s |

### Polling Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `pdu_poll_duration_seconds` | Histogram | `pdu_name`, `pdu_id` | PDU polling duration. Buckets: 0.5, 1, 2, 5, 10, 30s |
| `pdu_poll_errors_total` | Counter | `pdu_name`, `pdu_id`, `error_type` | Total polling errors |

### Default Node.js Metrics

Collected automatically by `prom-client` unless `PROMETHEUS_DEFAULT_METRICS=false`. Includes:
- `process_cpu_*` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_heap_*` - V8 heap metrics
- `nodejs_eventloop_*` - Event loop lag
- `nodejs_gc_*` - Garbage collection

## Public API

| Method | Signature | Description |
|--------|-----------|-------------|
| `updatePowerMetrics` | `(pdu, metrics) => void` | Sets power draw, watts, voltage, and load state gauges. |
| `updateOutletStates` | `(pdu, outlets[]) => void` | Sets outlet state gauge for each outlet. |
| `updatePDUStatus` | `(pdu, status) => void` | Sets PDU online/offline gauge. Updates `last_seen` timestamp when online. |
| `recordStateChange` | `(pdu, outlet, changeType, fromState, toState) => void` | Increments state change counter with full context labels. |
| `recordError` | `(pdu, errorType, operation) => void` | Increments error counter. |
| `startSNMPTimer` | `(pdu, operation) => () => void` | Returns a stop function that records SNMP request duration. |
| `startPollTimer` | `(pdu) => () => void` | Returns a stop function that records poll duration. |
| `recordPollError` | `(pdu, errorType) => void` | Increments poll error counter. |
| `getMetrics` | `() => Promise<string>` | Returns all metrics in Prometheus text exposition format. |
| `getContentType` | `() => string` | Returns the Prometheus content type header value. |
| `reset` | `() => void` | Clears all metrics from the registry. For testing only. |

## Timer Pattern

Timer methods use prom-client's `Histogram.startTimer()`:

```typescript
// Start timing
const timer = prometheusService.startSNMPTimer(pdu, 'getOutletStates');

// ... perform operation ...

// Stop timing and record duration
timer();
```

## State Value Mappings

### Load State to Numeric

| State | Value |
|-------|-------|
| `normal` | 0 |
| `low` | 1 |
| `near_overload` | 2 |
| `overload` | 3 |

### Outlet State to Numeric

| State | Value |
|-------|-------|
| `off` | 0 |
| `on` | 1 |
| `reboot` | 2 |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PROMETHEUS_DEFAULT_METRICS` | `(enabled)` | Set to `'false'` to disable default Node.js metrics collection |

## Dependencies

- `prom-client` (`Registry`, `Gauge`, `Counter`, `Histogram`, `collectDefaultMetrics`)
- `logger` from `../utils/logger`

## Integration Points

### Consumers of `startSNMPTimer` / `recordError`
- `SNMPService` - times `getOutletStates`, `setOutletPower`, `getPowerMetrics`; records SNMP errors

### Consumers of `updatePowerMetrics` / `updateOutletStates` / `updatePDUStatus`
- `SchedulerService` - updates on each poll and metrics collection cycle

### Consumers of `startPollTimer` / `recordPollError`
- `SchedulerService` - times each PDU poll cycle

### Consumers of `recordStateChange`
- `StateManager` - records state changes during reconciliation and outlet state updates

### Metrics Endpoint
- Exposed via an API route that calls `getMetrics()` and sets the content type header from `getContentType()`
