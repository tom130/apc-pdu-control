# Specs Directory

Lookup table for all specification documents in this repository.

## Backend

| Spec | File | Covers |
|------|------|--------|
| SNMP Service | [snmp-service.md](backend/snmp-service.md) | SNMP v1/v2c/v3 protocol handling, OID management, session lifecycle, error handling |
| WebSocket Service | [websocket-service.md](backend/websocket-service.md) | WS connection management, message types, broadcasting, client tracking |
| Prometheus Service | [prometheus-service.md](backend/prometheus-service.md) | Metric definitions (gauges, counters, histograms), labels, collection |
| Scheduler Service | [scheduler-service.md](backend/scheduler-service.md) | PDU polling, reachability edges, scheduled outlet jobs |
| State Manager Service | [state-manager-service.md](backend/state-manager-service.md) | Restore snapshot capture and one-shot power-loss restore |
| Middleware & Utilities | [middleware.md](backend/middleware.md) | M2M auth middleware, AES-256-GCM crypto, logger, constants |
| API Routes | [api-routes.md](backend/api-routes.md) | All REST endpoints: PDU, outlet, system, metrics, M2M, API keys |
| Database Schema | [database-schema.md](backend/database-schema.md) | Tables, columns, types, relationships, Drizzle ORM schema, migrations |
| Entry Point | [entry-point.md](backend/entry-point.md) | Server bootstrap, Elysia plugin registration, middleware chain, startup sequence |

## Frontend

| Spec | File | Covers |
|------|------|--------|
| App & Routing | [app-routing.md](frontend/app-routing.md) | React Router setup, provider tree, ThemeProvider, layout system |
| Pages | [pages.md](frontend/pages.md) | Dashboard, PDUDetail, Events, Settings - layout, data flow, interactions |
| PDU Components | [pdu-components.md](frontend/pdu-components.md) | PDUCard, PDUInfo, PDUConfigDialog, AddPDUDialog, OutletGrid, SortableOutletCard, PowerMetricsChart, RecentEventsCard, SystemHealthCard |
| State & API | [state-and-api.md](frontend/state-and-api.md) | Zustand store (pduStore), API client, React Query queries/mutations |
| Types | [types.md](frontend/types.md) | TypeScript type definitions for PDU, Outlet, Event, PowerMetrics, etc. |

## Infrastructure

| Spec | File | Covers |
|------|------|--------|
| Docker | [docker.md](infrastructure/docker.md) | Dockerfiles, compose files (dev/prod), services, networking, volumes |
| CI/CD | [ci-cd.md](infrastructure/ci-cd.md) | GitHub Actions workflow, build triggers, Docker registry push |
| Configuration | [configuration.md](infrastructure/configuration.md) | Env vars, Makefile targets, tsconfig, Vite, Tailwind, Drizzle config |
| Deployment | [deployment.md](infrastructure/deployment.md) | Production setup, requirements, steps, reverse proxy, SSL |

## Test Layers

Backend pure-logic and source-invariant tests live under `backend/src/**/__tests__` and run with `cd backend && bun test`. The suite mocks database/SNMP behavior; live PDU and live Postgres integration tests are intentionally out of scope for this repository.
