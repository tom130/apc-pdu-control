# Docker Infrastructure Spec

## Overview

The application uses a multi-container Docker architecture with separate services for the frontend, backend, and database. Two compose files provide development and production configurations.

## Container Images

### Backend (`backend/Dockerfile`)

Multi-stage build using Bun runtime.

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| `builder` | `oven/bun:1-alpine` | Install deps, compile TypeScript via `bun build` |
| Production | `oven/bun:1-alpine` | Run compiled JS with minimal footprint |

**Build steps:**
1. Copy `package.json` and `bun.lock*`
2. `bun install --frozen-lockfile`
3. Copy source code
4. `bun build ./src/index.ts --outdir=./dist --target=bun`

**Production stage details:**
- Installs `net-snmp-tools` via apk (required for SNMP PDU communication)
- Copies `dist/`, `node_modules/`, and `package.json` from builder
- Creates non-root user `nodejs` (UID 1001, GID 1001)
- Runs as `nodejs` user
- Exposes port **3001**
- Entrypoint: `bun run dist/index.js`

### Frontend (`frontend/Dockerfile`)

Multi-stage build producing a static Nginx site.

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| `builder` | `node:20-alpine` | Install deps, build Vite/React app |
| Production | `nginx:alpine` | Serve static files + reverse proxy |

**Build steps:**
1. Copy `package*.json`
2. `npm ci` (full install for build tooling)
3. Copy source code
4. `npm run build` (Vite production build)

**Production stage details:**
- Copies `dist/` from builder to `/usr/share/nginx/html`
- Generates inline Nginx config (see Nginx Configuration below)
- Built-in healthcheck: `wget --spider http://localhost/` every 30s
- Exposes port **80**
- Entrypoint: `nginx -g "daemon off;"`

**Nginx Configuration (embedded in Dockerfile):**

| Location | Behavior |
|----------|----------|
| `/` | Serves static files with SPA fallback (`try_files $uri $uri/ /index.html`) |
| `/api` | Reverse proxy to `http://backend:3001` with WebSocket upgrade headers |
| `/ws` | Reverse proxy to `http://backend:3001` with WebSocket upgrade headers |

Both `/api` and `/ws` proxy locations set: `Upgrade`, `Connection`, `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` headers.

## Docker Compose Files

### Development (`docker-compose.yml`)

Compose version: `3.8`

#### Services

| Service | Image | Container Name | Ports | Notes |
|---------|-------|----------------|-------|-------|
| `postgres` | `postgres:16-alpine` | `apc-pdu-postgres` | `5432:5432` | Healthcheck via `pg_isready` |
| `backend` | Built from `./backend/Dockerfile` | `apc-pdu-backend` | `3001:3001` | Depends on postgres (healthy) |
| `frontend` | `node:20-alpine` (live dev) | `apc-pdu-frontend` | `5173:5173` | Depends on backend |
| `pgadmin` | `dpage/pgadmin4:latest` | `apc-pdu-pgadmin` | `5050:80` | Profile: `tools` (opt-in) |

**Development-specific behaviors:**
- Frontend runs `npm install && npm run dev -- --host 0.0.0.0` directly (no build step)
- Frontend mounts entire `./frontend` directory as volume for hot reload
- Backend mounts source files as read-only volumes for live reloading:
  - `./backend/src:/app/src:ro`
  - `./backend/package.json:/app/package.json:ro`
  - `./backend/tsconfig.json:/app/tsconfig.json:ro`
- `NODE_ENV=development`, `LOG_LEVEL=debug`
- Hardcoded dev credentials: `apc_user` / `apc_password`
- pgAdmin available via `--profile tools`

**Network:** `apc-pdu-network` (bridge driver)

**Volumes:** `postgres_data`, `pgadmin_data`

**Database init:** `./backend/database/schema.sql` mounted to `/docker-entrypoint-initdb.d/01-schema.sql:ro`. This is the single Docker fresh-install bootstrap artifact and is kept in parity with `backend/src/db/schema.ts`.

### Production (`docker-compose.prod.yml`)

Compose version: `3.8`

#### Services

| Service | Image | Container Name | Ports | Notes |
|---------|-------|----------------|-------|-------|
| `postgres` | `postgres:16-alpine` | `apc-pdu-db` | None (internal only) | Healthcheck via `pg_isready` |
| `backend` | `ghcr.io/${GITHUB_REPOSITORY}-backend:${VERSION}` | `apc-pdu-backend` | None (internal only) | Healthcheck via `curl http://localhost:3001/health` |
| `frontend` | `ghcr.io/${GITHUB_REPOSITORY}-frontend:${VERSION}` | `apc-pdu-frontend` | `${FRONTEND_PORT:-80}:80` | Healthcheck via `wget --spider http://localhost/` |
| `prometheus` | `prom/prometheus:latest` | `apc-pdu-prometheus` | `${PROMETHEUS_PORT:-9090}:9090` | Profile: `monitoring` |
| `grafana` | `grafana/grafana:latest` | `apc-pdu-grafana` | `${GRAFANA_PORT:-3000}:3000` | Profile: `monitoring` |

**Production-specific behaviors:**
- Uses pre-built images from GHCR (no local build context)
- All credentials parameterized via env vars with defaults
- Backend and postgres ports are NOT exposed to host (only frontend is externally accessible)
- Frontend Nginx handles reverse proxying to backend internally
- `NODE_ENV=production`, `LOG_LEVEL=info` (default)
- Backend healthcheck with 40s start period
- Monitoring stack (Prometheus + Grafana) available via `--profile monitoring`

**Network:** `apc-network` (bridge driver, explicit subnet `172.20.0.0/16`)

**Volumes:** `postgres_data`, `prometheus_data`, `grafana_data` (all with `driver: local`)

## Key Differences: Dev vs Prod

| Aspect | Development | Production |
|--------|-------------|------------|
| Frontend serving | Vite dev server (port 5173) | Nginx (port 80) with reverse proxy |
| Backend image | Built locally from Dockerfile | Pre-built from GHCR |
| Source mounting | Volumes for live reload | No volumes (baked into image) |
| Exposed ports | All services exposed | Only frontend (80) exposed |
| Credentials | Hardcoded defaults | Env var parameterized |
| Database init | Same schema.sql mount, aligned with Drizzle schema | Same schema.sql mount, aligned with Drizzle schema |
| Monitoring | None | Prometheus + Grafana (opt-in) |
| API routing | Direct to `localhost:3001` | Via Nginx reverse proxy (`/api`, `/ws`) |
| Node env | `development` | `production` |
| Log level | `debug` | `info` |

## Service Dependency Graph

```
frontend
  └── backend
        └── postgres (condition: service_healthy)
prometheus (independent, monitoring profile)
grafana (independent, monitoring profile)
pgadmin (dev only, tools profile)
  └── postgres
```

## Health Checks

| Service | Method | Interval | Timeout | Retries | Start Period |
|---------|--------|----------|---------|---------|--------------|
| `postgres` | `pg_isready -U ${DB_USER}` | 10s | 5s | 5 | - |
| `backend` (prod) | `curl -f http://localhost:3001/health` | 30s | 10s | 3 | 40s |
| `frontend` (prod) | `wget --spider http://localhost/` | 30s | 10s | 3 | - |
| `frontend` (Dockerfile) | `wget --spider http://localhost/` | 30s | 3s | 3 | 5s |
