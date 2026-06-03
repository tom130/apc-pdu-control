# PDU Components Specification

## 1. PDUCard

**File:** `src/components/pdu/PDUCard.tsx`

### Purpose

Dashboard card representing a single PDU. Shows key stats and navigates to the PDU detail page on click.

### Props

```typescript
interface PDUCardProps {
  pdu: PDU;
}
```

### Store Access

| Selector | Purpose |
|----------|---------|
| `getOutletsByPduId(pdu.id)` | Get outlet count and on/off stats |

### Display

| Field | Source | Format |
|-------|--------|--------|
| Name | `pdu.name` | Card title with Server icon |
| Status | `pdu.isActive` | Badge: "Active" (success) / "Inactive" (secondary) |
| IP Address | `pdu.ipAddress` | Card description |
| Model | `pdu.model` | Text, fallback: "Unknown" |
| Total Outlets | `outlets.length` | Count |
| Outlets On | Filtered `actualState === 'on'` | Count with green Power icon |
| Auto-Restore | `autoRecovery` count / `outlets.length` | Count with restore icon |
| Last Seen | `pdu.lastSeen` | Format: `HH:mm:ss` |

### Interactions

- Entire card is clickable: `navigate(/pdu/${pdu.id})`
- "View Details" button at bottom: same navigation (with `stopPropagation` to prevent double nav)
- Hover effect: `hover:shadow-lg transition-shadow`

---

## 2. PDUInfo

**File:** `src/components/pdu/PDUInfo.tsx`

### Purpose

Information card shown on the PDU detail page sidebar. Displays PDU metadata and current power metrics.

### Props

```typescript
interface PDUInfoProps {
  pdu: PDU;
  metrics?: PowerMetrics | null;
}
```

### Display

| Field | Source | Condition |
|-------|--------|-----------|
| Status | `pdu.isActive` | Always |
| Model | `pdu.model` | Always (fallback: "Unknown") |
| SNMP Version | `pdu.snmpVersion` | Always |
| Power Draw | `metrics.totalPowerDraw` / `metrics.totalPowerWatts` | When `metrics` provided |
| Load State | `metrics.loadState` | When `metrics` provided |
| Last Seen | `pdu.lastSeen` | When available |

### Power Display

- Format: `{amps}A / {watts}W`
- Watts fallback: `Math.round(totalPowerDraw * 230)` (EU 230V assumed)
- Load state badge colors:

| Load State | Badge Variant |
|------------|---------------|
| `normal` | `success` |
| `low` | `secondary` |
| `near_overload` | `warning` |
| `overload` | `destructive` |

---

## 3. PDUConfigDialog

**File:** `src/components/pdu/PDUConfigDialog.tsx`

### Purpose

Modal dialog for editing an existing PDU's configuration (name, IP, model, SNMP settings).

### Props

```typescript
interface PDUConfigDialogProps {
  pdu: PDU;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
```

### Form State

Initialized from `pdu` prop. Same SNMP conditional field logic as AddPDUDialog:
- v1/v2c: Community string field
- v3: Username, Security Level, conditional Auth/Privacy fields
- Auth/Priv passphrases: Placeholder "Leave blank to keep existing"

### Submit Behavior

1. Validates name + IP required
2. Validates v3 security level requirements (same rules as Add)
3. Builds update payload: always includes name, IP, model, snmpVersion, snmpUser
4. Conditionally includes v3 fields when `snmpVersion === 'v3'`
5. Only includes passphrases if non-empty (to preserve existing)
6. Calls `pduApi.updatePDU(pdu.id, updateData)`
7. On success: toast, close dialog, call `onSuccess`

### Max Width

`max-w-2xl` for the dialog content.

---

## 4. AddPDUDialog

**File:** `src/components/pdu/AddPDUDialog.tsx`

### Purpose

Modal dialog for adding a new PDU with SNMP configuration and connection testing.

### Props

```typescript
interface AddPDUDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
```

### Form Fields

Same SNMP configuration fields as PDUConfigDialog with required markers (`*`) on Name and IP Address.

For v1/v2c community string: spans 2 columns with helper text about APC defaults.

### Actions

| Button | Location | Behavior |
|--------|----------|----------|
| Test Connection | Dialog footer (left) | Creates temp PDU -> tests -> deletes temp PDU -> toast result |
| Cancel | Dialog footer (right) | Closes dialog |
| Add PDU | Dialog footer (right) | Validates -> creates PDU -> resets form -> closes -> calls `onSuccess` |

### Test Connection Flow

1. Validate IP address is provided
2. Create temporary PDU via `pduApi.createPDU()` with name fallback `Test-{timestamp}`
3. Test via `pduApi.testPDUConnection(tempPdu.id)`
4. Always delete the temp PDU after test
5. Show toast with result

---

## 5. OutletGrid

**File:** `src/components/pdu/OutletGrid.tsx`

### Purpose

Interactive grid of outlet cards with drag-and-drop reordering, bulk power operations, and search filtering.

### Props

```typescript
interface OutletGridProps {
  pduId: string;
  outlets: Outlet[];
  columns?: number;  // Unused in implementation
}
```

### Local State

| State | Type | Purpose |
|-------|------|---------|
| `selectedOutlets` | `Set<string>` | Currently selected outlet IDs |
| `searchTerm` | `string` | Filter outlets by name/number |
| `isReorganizing` | `boolean` | Drag-and-drop mode active |
| `activeId` | `string \| null` | Currently dragging outlet ID |
| `hasChanges` | `boolean` | Unsaved reorder changes exist |
| `sortedOutlets` | `Outlet[]` | Local copy for reorder operations |

### Store Access

| Action | Purpose |
|--------|---------|
| `updateOutlet` | Update outlet state after power mutation |
| `reorderOutlets` | Persist new outlet order |

### Mutations

| Mutation | API Call | On Success |
|----------|----------|-----------|
| `powerMutation` | `pduApi.setOutletPower(pduId, outletId, state)` | `updateOutlet(pduId, outletId, { actualState: newState })` |
| `reorderMutation` | `pduApi.reorderOutlets(pduId, outletIds)` | `reorderOutlets(pduId, data)`, reset changes flag |
| `resetOrderMutation` | `pduApi.resetOutletOrder(pduId)` | `reorderOutlets(pduId, data)`, exit reorganize mode |

### Modes

#### Default Mode (no selection, not reorganizing)
- Shows "Reorganize" button
- Search bar + "Select All" button
- Clicking outlet checkbox toggles selection

#### Selection Mode (outlets selected)
- Shows selection count badge
- Bulk actions: "All On" (green), "All Off", "Reboot"
- Search bar + "Select All"/"Deselect All" toggle

#### Reorganize Mode
- Shows "Save Order" (disabled until changes), "Reset to Default", "Cancel"
- "Unsaved changes" badge when `hasChanges`
- Drag handles appear on cards
- Selection checkboxes hidden

### Drag and Drop

Uses `@dnd-kit/core` with:
- `PointerSensor` (8px activation distance)
- `KeyboardSensor` (sortable keyboard coordinates)
- `closestCenter` collision detection
- `rectSortingStrategy` for grid layout
- `DragOverlay` shows semi-transparent copy of dragged card

### Search/Filter

Filters outlets by name (case-insensitive) or outlet number (string match).

### Grid Layout

`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6` with `gap-3`.

---

## 6. SortableOutletCard

**File:** `src/components/pdu/SortableOutletCard.tsx`

### Purpose

Individual outlet card within the OutletGrid. Supports selection, power toggle, reboot, scheduling, drag-and-drop, and restore flag editing.

### Props

```typescript
interface SortableOutletCardProps {
  outlet: Outlet;
  isSelected: boolean;
  onToggle: () => void;
  onReboot: () => void;
  onSchedule?: () => void;
  onSelect: () => void;
  onAutoRecoveryChange: (autoRecovery: boolean) => void;
  onCriticalChange: (isCritical: boolean) => void;
  isLoading: boolean;
  isUpdatingFlags: boolean;
  isReorganizing: boolean;
}
```

### DnD Integration

Uses `useSortable` from `@dnd-kit/sortable`:
- `id: outlet.id`
- `disabled: !isReorganizing` (only sortable in reorganize mode)
- Applies `CSS.Transform.toString(transform)` and `transition` to the wrapper

### Visual States

| Condition | Visual |
|-----------|--------|
| ON | Green gradient background, Zap icon, pulsing green ring, "ON" pill |
| OFF | Gray gradient background, Power icon, "OFF" pill |
| Selected | Primary border, shadow with primary color |
| Critical | Red border, Shield badge |
| Auto-restore | Small restore badge and a `Restore` switch |
| Dragging | `opacity-50`, `z-50`, `shadow-2xl` |

### Layout Structure

```
+---------------------------+
| [DragHandle] [Badges] [Checkbox] |
| Outlet Name               |
| #number                   |
|     (Power Button)        |
|      [ON/OFF pill]        |
| [Critical switch] [Restore switch] |
| [Reboot button] [Schedule button] |
+---------------------------+
```

### Disabled States

Power button and reboot are disabled when:
- `isLoading` is true
- `outlet.isCritical` is true
- `isReorganizing` is true (power button only)

---

## 7. PowerMetricsChart

**File:** `src/components/pdu/PowerMetricsChart.tsx`

### Purpose

Displays current power usage as a progress bar with metric breakdown. Shown on PDU detail sidebar.

### Props

```typescript
interface PowerMetricsChartProps {
  metrics: PowerMetrics;
}
```

### Calculations

| Value | Formula |
|-------|---------|
| `maxPowerWatts` | `3450` (15A x 230V, typical EU PDU) |
| `powerWatts` | `metrics.totalPowerWatts \|\| (metrics.totalPowerDraw * 230)` |
| `percentage` | `(powerWatts / maxPowerWatts) * 100`, capped at 100% for bar |

### Bar Colors

| Load State | Color |
|------------|-------|
| `overload` | `bg-red-500` |
| `near_overload` | `bg-yellow-500` |
| `low` | `bg-blue-500` |
| `normal` | `bg-green-500` |

### Metric Grid (2x2)

| Cell | Value |
|------|-------|
| Current | `{totalPowerDraw} A` |
| Power | `{powerWatts} W` |
| Voltage | `{voltage \|\| 230} V` |
| Status | `{loadState}` (capitalized, underscores removed) |

---

## 8. RecentEventsCard

**File:** `src/components/pdu/RecentEventsCard.tsx`

### Purpose

Shows the 20 most recent events on the Dashboard. Auto-refreshes every 60 seconds.

### Data Flow

| Query Key | API Call | Interval |
|-----------|----------|----------|
| `['events']` | `pduApi.getAllEvents(20)` | 60s |

Also reads `pdus` from Zustand store for PDU name resolution.

### Event Icons

| Event Type | Icon | Color |
|------------|------|-------|
| `connection_lost` | WifiOff | Red |
| `connection_restored` | Wifi | Green |
| `recovery_complete` | CheckCircle2 | Green |
| `state_skew` | AlertCircle | Yellow; labeled "load warning" |
| Default | Power | Default |

### Event Badge Variants

| Event Type | Variant |
|------------|---------|
| `connection_lost` | `destructive` |
| `connection_restored` | `success` |
| `recovery_complete` | `success` |
| `state_skew` | `warning` |
| Default | `secondary` |

### Event Row

- Icon + Badge (event type) + PDU name
- Description
- Timestamp (`MMM dd, HH:mm:ss`)
- Hover effect: `hover:bg-accent/50`

---

## 9. SystemHealthCard

**File:** `src/components/pdu/SystemHealthCard.tsx`

### Purpose

Full-width dashboard card showing aggregate system health metrics.

### Store Access

Reads `systemHealth` from Zustand store. Shows loading placeholder if `null`.

### Health Status Calculation

| Skew % | Status | Badge Variant |
|--------|--------|--------------|
| < 5% | `excellent` | `success` |
| < 10% | `good` | `secondary` |
| < 20% | `warning` | `warning` |
| >= 20% | `critical` | `destructive` |

### Metric Grid (4 columns on md+)

| Metric | Icon | Color |
|--------|------|-------|
| Total PDUs | Server | Primary |
| Active PDUs | Activity | Green |
| Total Outlets | Zap | Blue |
| Restore Drift % | AlertTriangle | Yellow (>10%) / Green (<=10%) |

### Footer

Average Response Time with badge:
- `< 100ms`: success variant
- `>= 100ms`: warning variant

### Layout

Uses `col-span-full` to span the entire grid width on the dashboard.
