# Configuration Spec

## Environment Variables

### Root `.env.example` (Production Compose)

Used by `docker-compose.prod.yml`. All variables are consumed via `${VAR:-default}` interpolation in the compose file.

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GITHUB_REPOSITORY` | GHCR image namespace | `yourusername/apc-pdu-control` | Yes (for image pull) |
| `VERSION` | Image tag to deploy | `latest` | No |
| `DB_USER` | PostgreSQL username | `apc_user` | No |
| `DB_PASSWORD` | PostgreSQL password | - | Yes |
| `DB_NAME` | PostgreSQL database name | `apc_pdu` | No |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost` | Yes (for production) |
| `LOG_LEVEL` | Backend log level | `info` | No |
| `ENCRYPTION_KEY` | 32-char key for SNMP credential encryption | - | Yes |
| `SNMP_TIMEOUT` | SNMP request timeout (ms) | `5000` | No |
| `SNMP_RETRIES` | SNMP retry count | `3` | No |
| `POLL_INTERVAL` | PDU polling period (ms) | `30000` | No |
| `SCHEDULE_CHECK_INTERVAL` | One-time/cron schedule check period (ms) | `60000` | No |
| `METRICS_INTERVAL` | Power metrics collection period (ms) | `300000` | No |
| `PROMETHEUS_ENABLED` | Enable Prometheus metrics | `true` | No |
| `PROMETHEUS_DEFAULT_METRICS` | Collect default Node.js metrics | `true` | No |
| `FRONTEND_PORT` | Host port for frontend | `80` | No |
| `PROMETHEUS_PORT` | Host port for Prometheus | `9090` | No |
| `GRAFANA_PORT` | Host port for Grafana | `3000` | No |
| `GRAFANA_USER` | Grafana admin username | `admin` | No |
| `GRAFANA_PASSWORD` | Grafana admin password | - | Yes (if monitoring) |

**Generating encryption key:** `openssl rand -hex 16`

### Backend `.env.example`

Used for local development (running backend outside Docker).

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | HTTP server port | `3001` |
| `DATABASE_URL` | Full PostgreSQL connection string | `postgresql://apc_user:apc_password@localhost:5432/apc_pdu` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `LOG_LEVEL` | Log verbosity | `debug` |
| `SNMP_TIMEOUT` | SNMP request timeout (ms) | `5000` |
| `SNMP_RETRIES` | SNMP retry count | `3` |
| `ENCRYPTION_KEY` | 32-char encryption key | Placeholder |
| `SCHEDULER_ENABLED` | Enable scheduled task execution | `true` |
| `SCHEDULE_CHECK_INTERVAL` | Scheduler check period (ms) | `60000` |
| `WS_HEARTBEAT_INTERVAL` | WebSocket heartbeat (ms) | `30000` |
| `WS_MAX_CONNECTIONS` | Max WebSocket connections | `100` |
| `METRICS_RETENTION_DAYS` | Power metrics retention | `30` |
| `EVENTS_RETENTION_DAYS` | Event log retention | `90` |
| `PROMETHEUS_ENABLED` | Enable Prometheus endpoint | `true` |
| `PROMETHEUS_DEFAULT_METRICS` | Collect Node.js default metrics | `true` |
| `POLL_INTERVAL` | PDU poll interval override (ms) | `30000` |
| `METRICS_INTERVAL` | Power metrics collection interval (ms) | `300000` |

### Frontend `.env.example`

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:3001/api` |
| `VITE_WS_URL` | WebSocket URL (optional) | `ws://localhost:3001/ws` |

Note: In production, these are not needed because the Nginx reverse proxy routes `/api` and `/ws` to the backend internally.

## Makefile Targets

### Root Makefile

| Target | Description |
|--------|-------------|
| `help` | Print available commands (default) |
| `install` | Install backend (`bun install`) and frontend (`npm install`) deps |
| `dev` | Start backend and frontend dev servers in parallel (`make -j 2`) |
| `backend-dev` | Start backend dev server (`bun run dev`) |
| `frontend-dev` | Start frontend dev server (`npm run dev`) |
| `build` | Build both backend and frontend for production |
| `test` | Run backend (`bun test`) and frontend (`npm test`) tests |
| `docker-build` | `docker-compose build` |
| `docker-up` | `docker-compose up -d` |
| `docker-down` | `docker-compose down` |
| `docker-logs` | `docker-compose logs -f` |
| `docker-clean` | `docker-compose down -v` + remove backend image |
| `postgres` | Start only the postgres container |
| `db-migrate` | Run migrations via `docker-compose exec backend bun run db:migrate` |
| `db-seed` | Seed database via `docker-compose exec backend bun run db:seed` |
| `logs-backend` | Tail backend logs |
| `logs-frontend` | Tail frontend logs |
| `logs-postgres` | Tail postgres logs |
| `shell-backend` | Open shell in backend container |
| `shell-postgres` | Open psql session in postgres container |
| `pgadmin` | Start pgAdmin (tools profile) |
| `test-power` | Curl test of power metrics endpoint |
| `clean` | Remove all build artifacts and `node_modules` |

### Backend Makefile

Mirrors root Makefile patterns with backend-specific targets:

| Target | Description |
|--------|-------------|
| `help` | Print available commands (default) |
| `install` | `bun install` |
| `dev` | `bun run dev` |
| `build` | `bun run build` |
| `test` | `bun test` |
| `docker-*` | Same Docker targets as root |
| `db-migrate` | Run database migrations |
| `db-seed` | Seed database |
| `postgres` | Start postgres service |
| `services` | Start postgres and print connection string |
| `fullstack` | Start postgres, then frontend + backend |
| `prod-build` | Build backend Docker image locally |
| `prod-run` | Run backend image with `--env-file .env` |
| `shell-backend` | Shell into backend container |
| `shell-postgres` | psql into postgres container |
| `pgadmin` | Start pgAdmin |

## TypeScript Configuration

### Backend `tsconfig.json`

| Option | Value | Purpose |
|--------|-------|---------|
| `target` | `ES2022` | Modern JS output |
| `module` | `ESNext` | ESM modules |
| `moduleResolution` | `bundler` | Bundler-style resolution |
| `lib` | `["ES2022"]` | No DOM types (server-side) |
| `types` | `["bun-types"]` | Bun runtime type definitions |
| `jsx` | `react-jsx` | JSX transform (likely unused in backend) |
| `strict` | `true` | Full strict mode |
| `esModuleInterop` | `true` | CJS/ESM interop |
| `skipLibCheck` | `true` | Skip `node_modules` type checking |
| `resolveJsonModule` | `true` | Allow JSON imports |
| `isolatedModules` | `true` | Per-file transpilation safety |
| `noEmit` | `true` | No direct TS output (Bun handles build) |
| `paths` | `@/* -> ./src/*` | Path alias |

Include: `src/**/*`. Exclude: `node_modules`, `dist`.

### Frontend `tsconfig.json`

| Option | Value | Purpose |
|--------|-------|---------|
| `target` | `ES2020` | Browser-compatible output |
| `module` | `ESNext` | ESM modules |
| `moduleResolution` | `bundler` | Vite-compatible resolution |
| `lib` | `["ES2020", "DOM", "DOM.Iterable"]` | Browser + DOM types |
| `jsx` | `react-jsx` | React JSX transform |
| `strict` | `true` | Full strict mode |
| `noUnusedLocals` | `true` | Catch unused variables |
| `noUnusedParameters` | `true` | Catch unused params |
| `noFallthroughCasesInSwitch` | `true` | Switch safety |
| `allowImportingTsExtensions` | `true` | Allow `.ts` in imports |
| `noEmit` | `true` | Vite handles compilation |
| `paths` | `@/* -> ./src/*` | Path alias |

Include: `src`. References: `tsconfig.node.json`.

### Frontend `tsconfig.node.json`

Separate config for Vite config file processing:

| Option | Value |
|--------|-------|
| `composite` | `true` |
| `module` | `ESNext` |
| `moduleResolution` | `bundler` |
| `allowSyntheticDefaultImports` | `true` |

Include: `vite.config.ts` only.

## Vite Configuration (`frontend/vite.config.ts`)

```ts
plugins: [react()]
resolve.alias: { '@': './src' }
```

- Uses `@vitejs/plugin-react` for React Fast Refresh
- Path alias `@` maps to `./src` (mirrors tsconfig paths)
- No custom server, port, or proxy configuration (dev compose handles API URL via env vars)

## Tailwind CSS Configuration (`frontend/tailwind.config.js`)

| Option | Value |
|--------|-------|
| `darkMode` | `["class"]` (class-based dark mode) |
| `content` | `["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]` |
| Container | Centered, `2rem` padding, max `1400px` at 2xl |

**Custom theme (shadcn/ui pattern):**
- Colors defined via CSS custom properties (`hsl(var(--border))`, etc.)
- Color tokens: `border`, `input`, `ring`, `background`, `foreground`, `primary`, `secondary`, `destructive`, `muted`, `accent`, `popover`, `card` (each with foreground variant)
- Custom border-radius using `--radius` CSS variable
- Accordion animations (`accordion-down`, `accordion-up`) using Radix UI height variable

**Plugins:**
- `@tailwindcss/forms` - form element styling
- `@tailwindcss/typography` - prose content styling

## PostCSS Configuration (`frontend/postcss.config.js`)

```js
plugins: { tailwindcss: {}, autoprefixer: {} }
```

Standard Tailwind + Autoprefixer pipeline.

## Drizzle ORM Configuration (`backend/drizzle.config.ts`)

| Option | Value |
|--------|-------|
| `schema` | `./src/db/schema.ts` |
| `out` | `./drizzle` (migration output directory) |
| `driver` | `pg` (PostgreSQL) |
| `dbCredentials.connectionString` | `process.env.DATABASE_URL` |
| `verbose` | `true` |
| `strict` | `true` |

Used by Drizzle Kit for schema introspection and migration generation. The schema file at `./src/db/schema.ts` is the source of truth for database types.
