# App Structure, Routing, Providers & Theme System

## Overview

The frontend is a React SPA built with Vite, using React Router for client-side routing, TanStack React Query for server state management, Zustand for client state, and a custom ThemeProvider for light/dark/system theme support. The UI is built with shadcn/ui components and Tailwind CSS.

## Entry Point

**File:** `src/main.tsx`

- Renders `<App />` inside `<React.StrictMode>`
- Mounts to `#root` DOM element
- Imports global CSS (`index.css`)

## App Component

**File:** `src/App.tsx`

### Provider Hierarchy

```
<ThemeProvider>
  <QueryClientProvider>
    <BrowserRouter>
      <Layout>
        <Routes />
      </Layout>
      <Toaster />
    </BrowserRouter>
  </QueryClientProvider>
</ThemeProvider>
```

| Provider | Purpose |
|----------|---------|
| `ThemeProvider` | Outermost. Manages light/dark/system theme via context and localStorage |
| `QueryClientProvider` | TanStack React Query client for server state caching and refetching |
| `BrowserRouter` | React Router v6 for client-side navigation |
| `Layout` | Structural wrapper providing Header + Sidebar + main content area |
| `Toaster` | shadcn/ui toast notification container (rendered outside Layout) |

### React Query Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3,
      staleTime: 30 * 1000, // 30 seconds
    },
  },
});
```

| Option | Value | Purpose |
|--------|-------|---------|
| `refetchOnWindowFocus` | `false` | Prevents refetching when user switches tabs |
| `retry` | `3` | Retries failed queries up to 3 times |
| `staleTime` | `30000` (30s) | Data considered fresh for 30 seconds before background refetch |

## Route Definitions

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Navigate` to `/dashboard` | Root redirect |
| `/dashboard` | `<Dashboard />` | Main overview with PDU cards, system health, recent events |
| `/pdu/:id` | `<PDUDetail />` | Individual PDU detail with outlet control and metrics |
| `/events` | `<Events />` | Full event history with export |
| `/settings` | `<Settings />` | PDU management, system settings, API keys |

All routes render inside the `<Layout>` component, sharing the same Header and Sidebar.

## Theme System

**File:** `src/providers/ThemeProvider.tsx`

### Theme Type

```typescript
type Theme = 'light' | 'dark' | 'system';
```

### Context Interface

```typescript
interface ThemeContextType {
  theme: Theme;           // Current theme setting
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';  // Actual applied theme (resolves 'system')
}
```

### Behavior

1. **Initialization:** Reads `theme` from `localStorage`. Defaults to `'system'` if not set.
2. **Persistence:** Writes to `localStorage` on every change.
3. **DOM Application:** Adds/removes `'light'`/`'dark'` class on `document.documentElement`.
4. **System Theme Detection:** Uses `window.matchMedia('(prefers-color-scheme: dark)')`.
5. **Live System Changes:** When `theme === 'system'`, registers a `change` event listener on the media query to respond to OS-level theme changes in real time. Listener is cleaned up on unmount or when theme changes away from `'system'`.

### Theme Toggle Cycle (Header)

The Header component cycles through themes on button click:
- `light` -> `dark` -> `system` -> `light`

Visual indicators:
- Light mode: Sun icon
- Dark mode: Moon icon
- System mode: Small Monitor icon overlay

### Hook

```typescript
export function useTheme(): ThemeContextType
```

Throws if used outside `ThemeProvider`.

## Layout System

**File:** `src/components/layout/Layout.tsx`

```
+-------------------------------------------+
|                 Header (h-16)             |
+--------+----------------------------------+
| Sidebar|         Main Content             |
| (w-64) |         (flex-1, p-6)            |
|        |                                  |
|        |         {children}               |
|        |                                  |
+--------+----------------------------------+
```

- Full viewport height (`min-h-screen`)
- Background uses `bg-background` theme token
- Header is full-width at top
- Sidebar and main content are in a flex row below the header
- Sidebar height: `calc(100vh - 4rem)` (viewport minus header)

## Toast System

**File:** `src/hooks/use-toast.ts`

### Configuration

| Constant | Value | Purpose |
|----------|-------|---------|
| `TOAST_LIMIT` | `1` | Maximum visible toasts at once |
| `TOAST_REMOVE_DELAY` | `1000000` (ms) | Auto-removal delay (~16.7 minutes, effectively manual dismiss) |

### Architecture

- Uses a custom pub/sub pattern with `listeners` array and `memoryState` singleton
- Reducer pattern for state management (ADD, UPDATE, DISMISS, REMOVE actions)
- `useToast` hook subscribes components to toast state changes
- `toast()` function can be called imperatively outside React components

### Toast Interface

```typescript
type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
}
```

### Usage Pattern

```typescript
const { toast } = useToast();
toast({
  title: 'Success',
  description: 'Operation completed',
  variant: 'destructive', // for errors
});
```

## Utility Functions

**File:** `src/lib/utils.ts`

```typescript
export function cn(...inputs: ClassValue[]): string
```

Combines `clsx` (conditional class joining) with `tailwind-merge` (deduplicates/resolves conflicting Tailwind classes). Used throughout all components for dynamic class composition.

## Dependencies

| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | Core React |
| `react-router-dom` | Client-side routing |
| `@tanstack/react-query` | Server state management |
| `zustand` | Client state management |
| `axios` | HTTP client |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Drag-and-drop |
| `date-fns` | Date formatting |
| `lucide-react` | Icons |
| `clsx`, `tailwind-merge` | Class utilities |
| shadcn/ui components | UI primitives (Card, Button, Badge, Dialog, Input, Select, Switch, Toast) |
