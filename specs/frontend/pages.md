# Pages Specification

## 1. Dashboard

**File:** `src/pages/Dashboard.tsx`

### Purpose

Main landing page showing an overview of all PDUs, system health metrics, and recent events.

### Data Flow

| Query Key | API Call | Interval | Store Action |
|-----------|----------|----------|-------------|
| `['pdus']` | `pduApi.getPDUs()` | 30s | `setPdus(pduData)` |
| `['system-health']` | `pduApi.getSystemHealth()` | 30s | `setSystemHealth(healthData)` |

Data is fetched via React Query and synced to the Zustand store via `useEffect`.

### Local State

| State | Type | Purpose |
|-------|------|---------|
| `addPduDialogOpen` | `boolean` | Controls visibility of the Add PDU dialog |

### Layout

```
+--------------------------------------------------+
| Dashboard                    [Refresh] [Add PDU]  |
+--------------------------------------------------+
| [SystemHealthCard - col-span-full]               |
+--------------------------------------------------+
| [PDUCard] | [PDUCard] | [PDUCard]                |
| (grid: 2-col md, 3-col lg)                       |
+--------------------------------------------------+
| [RecentEventsCard - full width]                  |
+--------------------------------------------------+
```

### Loading State

Shows 3 animated skeleton cards (`animate-pulse`) while `pdusLoading || healthLoading`.

### User Interactions

| Action | Behavior |
|--------|----------|
| Click "Refresh" | Calls `refetchPdus()` to manually refresh PDU data |
| Click "Add PDU" | Opens `AddPDUDialog` |
| Click a PDU card | Navigates to `/pdu/:id` (handled by PDUCard) |
| AddPDUDialog success | Calls `refetchPdus()` to refresh the list |

---

## 2. PDU Detail

**File:** `src/pages/PDUDetail.tsx`

### Purpose

Detailed view of a single PDU showing outlet control grid, PDU information, and power metrics.

### Route Parameters

| Param | Type | Source |
|-------|------|--------|
| `id` | `string` | URL param from `/pdu/:id` |

### Data Flow

| Query Key | API Call | Interval | Store Action |
|-----------|----------|----------|-------------|
| `['outlets', id]` | `pduApi.getOutlets(id)` | 10s | `setOutlets(id, outletsData)` |
| `['metrics', id]` | `pduApi.getCurrentPowerMetrics(id)` | 30s | None (used directly) |

The PDU object itself comes from the Zustand store via `getPduById(id)`.

### Local State

| State | Type | Purpose |
|-------|------|---------|
| `configDialogOpen` | `boolean` | Controls PDU configuration dialog visibility |

### Layout

```
+-----------------------------------------------------------+
| [<-] PDU Name                 [Reconcile State] [Configure]|
|      192.168.x.x                                          |
+-----------------------------------------------------------+
| OutletGrid (2/3 width)    | PDUInfo         (1/3 width)  |
|                            | PowerMetricsChart             |
+-----------------------------------------------------------+
| [PDUConfigDialog - modal]                                 |
+-----------------------------------------------------------+
```

Grid layout: `md:grid-cols-3` with outlet grid spanning `md:col-span-2`.

### Not Found State

If `pdu` is not found in the store or `id` is missing, displays centered "PDU Not Found" message with a "Return to Dashboard" button.

### User Interactions

| Action | Behavior |
|--------|----------|
| Click back arrow | `navigate('/dashboard')` |
| Click "Refresh" | `refetchOutlets()` |
| Click "Configure" | Opens `PDUConfigDialog` |
| Config dialog success | Fetches updated PDU via `pduApi.getPDU(id)` and calls `updatePdu(id, data)` |

---

## 3. Events

**File:** `src/pages/Events.tsx`

### Purpose

Full event history page with a scrollable list and CSV export functionality.

### Data Flow

| Query Key | API Call | Interval | Store Access |
|-----------|----------|----------|-------------|
| `['all-events']` | `pduApi.getAllEvents(100)` | None (manual refresh) | `pdus` for PDU name lookup |

### Layout

```
+--------------------------------------------------+
| Events                       [Refresh] [Export CSV]|
+--------------------------------------------------+
| Card: Event History                               |
|  +----------------------------------------------+|
|  | [Badge: type] PDU Name              Timestamp ||
|  | Description                                   ||
|  +----------------------------------------------+|
|  | [Badge: type] PDU Name              Timestamp ||
|  | Description                                   ||
|  +----------------------------------------------+|
+--------------------------------------------------+
```

### Event Row Structure

Each event shows:
- Badge with `eventType` (underscores replaced with spaces)
- PDU name (looked up from store by `event.pduId`, fallback: "Unknown PDU")
- Description text
- Formatted timestamp (`MMM dd, HH:mm:ss`)

### States

| State | Display |
|-------|---------|
| Loading | "Loading events..." centered text |
| Empty | "No events recorded" centered muted text |
| Data | Scrollable list of event rows |

### CSV Export

Generates a CSV file with columns: `Timestamp, PDU, Event Type, Description`

- Timestamp format: `yyyy-MM-dd HH:mm:ss`
- PDU name resolved from store (fallback: "Unknown")
- Creates a Blob, generates object URL, triggers download via programmatic `<a>` click
- Filename: `pdu-events-{yyyy-MM-dd}.csv`

### User Interactions

| Action | Behavior |
|--------|----------|
| Click "Refresh" | Calls `refetch()` on the events query |
| Click "Export CSV" | Generates and downloads CSV file |

---

## 4. Settings

**File:** `src/pages/Settings.tsx`

### Purpose

Configuration page with four sections: Add New PDU, Configured PDUs, System Settings, and API Keys.

### Data Flow

| Source | Data | Method |
|--------|------|--------|
| Zustand store | `pdus`, `pollingInterval` | `usePDUStore()` |
| API (on mount) | `apiKeys` | `pduApi.getApiKeys()` via `useEffect` |

### Local State

| State | Type | Purpose |
|-------|------|---------|
| `isLoading` | `boolean` | Add PDU loading state |
| `isTestingConnection` | `boolean` | Test connection loading state |
| `newPdu` | `object` | Form data for new PDU (name, IP, model, SNMP config) |
| `apiKeys` | `ApiKey[]` | List of API keys |
| `newKeyName` | `string` | Name for new API key |
| `isCreatingKey` | `boolean` | Key creation loading state |
| `newlyCreatedKey` | `string \| null` | Newly created key value (show-once) |
| `showNewKey` | `boolean` | Toggle visibility of new key |

### Sections

#### 4a. Add New PDU Card

Form fields in 2-column grid:

| Field | Type | Required | Default |
|-------|------|----------|---------|
| PDU Name | Input | Yes | `''` |
| IP Address | Input | Yes | `''` |
| Model | Input | No | `''` |
| SNMP Version | Select (v1/v2c/v3) | Yes | `'v1'` |

**Conditional fields based on SNMP version:**

- **v1/v2c:** Community String (Input, default: `'public'`)
- **v3:** SNMP Username (Input, default: `'apc'`), Security Level (Select)
  - **authNoPriv/authPriv:** Auth Protocol (SHA/MD5), Auth Passphrase (password)
  - **authPriv:** Privacy Protocol (AES/DES), Privacy Passphrase (password)

**Actions:**
- "Add PDU": Validates name + IP required, creates PDU via API, refreshes list, resets form
- "Test Connection": Creates temporary PDU, tests connection, deletes on failure, refreshes list

#### 4b. Configured PDUs Card

Lists existing PDUs with:
- Name, IP address, model
- Active/Inactive badge
- Delete button (trash icon)

#### 4c. System Settings Card

- Polling Interval: Number input (5-300 seconds), displays as seconds, stored in ms
- "Apply" button (currently no-op beyond the input's onChange)

#### 4d. API Keys Card

- Create new key: Name input + "Create Key" button
- Newly created key display: Show/hide toggle, copy to clipboard, dismiss
- Key list: Name, key preview, last used date, active toggle (Switch), delete button

### Validation Rules

| Context | Rule |
|---------|------|
| Add PDU | Name and IP required |
| Test Connection | IP and SNMP user required |
| SNMPv3 authNoPriv/authPriv | Auth passphrase required |
| SNMPv3 authPriv | Privacy passphrase required |
| Create API Key | Key name required (non-empty) |

### User Interactions

| Action | Behavior |
|--------|----------|
| Add PDU | `pduApi.createPDU()` -> refresh list -> toast success/error |
| Test Connection | Create temp PDU -> `pduApi.testPDUConnection()` -> delete on failure -> toast result |
| Delete PDU | `pduApi.deletePDU()` -> refresh list -> toast |
| Change polling interval | Updates Zustand store via `setPollingInterval(value * 1000)` |
| Create API key | `pduApi.createApiKey()` -> show key value -> toast |
| Toggle API key | `pduApi.updateApiKey(id, { isActive })` -> update local state |
| Delete API key | `pduApi.deleteApiKey()` -> remove from local state |
| Copy API key | `navigator.clipboard.writeText()` -> toast confirmation |
