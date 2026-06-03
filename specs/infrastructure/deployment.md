# Deployment Spec

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database (included as container, or external)
- Network access to PDUs via SNMP

## Deployment Methods

### Method 1: Pre-built Images (Recommended)

```bash
git clone https://github.com/yourusername/apc-pdu-control.git
cd apc-pdu-control
cp .env.example .env
# Edit .env with production values
docker-compose -f docker-compose.prod.yml up -d
```

Images are pulled from GHCR automatically.

### Method 2: Build from Source

```bash
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### Method 3: Kubernetes

Use GHCR images in Kubernetes manifests. Sensitive values should use Kubernetes Secrets:

```yaml
containers:
  - name: backend
    image: ghcr.io/username/apc-pdu-control-backend:latest
    env:
      - name: DATABASE_URL
        valueFrom:
          secretKeyRef:
            name: apc-pdu-secrets
            key: database-url
```

### Method 4: Docker Swarm

```bash
docker stack deploy -c docker-compose.prod.yml apc-pdu
```

## Container Registry

**Registry:** GitHub Container Registry (`ghcr.io`)

| Image | Tag Examples |
|-------|-------------|
| `ghcr.io/{owner}/apc-pdu-control-backend` | `latest`, `v1.0.0`, `main-{sha}` |
| `ghcr.io/{owner}/apc-pdu-control-frontend` | `latest`, `v1.0.0`, `main-{sha}` |

Architecture: `linux/amd64` (arm64 currently disabled).

## Required Configuration

Before deploying, these variables **must** be set in `.env`:

| Variable | How to Generate |
|----------|----------------|
| `DB_PASSWORD` | Strong random password |
| `ENCRYPTION_KEY` | `openssl rand -hex 16` (32 hex chars) |
| `CORS_ORIGIN` | Your frontend domain (e.g., `https://pdu.example.com`) |
| `GITHUB_REPOSITORY` | Your GitHub `owner/repo` for image pulls |

## Database Initialization

The PostgreSQL schema is auto-initialized on first container start via Docker entrypoint:
- `backend/database/schema.sql` is mounted to `/docker-entrypoint-initdb.d/01-schema.sql`
- This is the single Docker fresh-install bootstrap artifact and is kept in parity with `backend/src/db/schema.ts`
- Creates tables: PDUs, outlets, outlet history, event logs, power metrics, one-time schedules, cron schedules, and API keys
- Only runs when the `postgres_data` volume is empty (first boot)

## Production Network Topology

```
Internet/LAN
     |
  [Frontend :80]  (only externally exposed port)
     |
     ├── Static files (Nginx)
     ├── /api/* --> [Backend :3001] (internal network only)
     └── /ws/*  --> [Backend :3001] (internal network only)
                         |
                    [Postgres :5432] (internal network only)
```

- Only the frontend port (default 80) is exposed to the host
- Backend and Postgres communicate on the internal `apc-network` (bridge, subnet `172.20.0.0/16`)
- Backend connects to physical PDUs via SNMP on the host network (requires SNMP reachability)

## Monitoring Stack (Optional)

Enable with the `monitoring` compose profile:

```bash
docker-compose -f docker-compose.prod.yml --profile monitoring up -d
```

| Service | Port | Credentials |
|---------|------|-------------|
| Prometheus | `${PROMETHEUS_PORT:-9090}` | None |
| Grafana | `${GRAFANA_PORT:-3000}` | `${GRAFANA_USER}` / `${GRAFANA_PASSWORD}` |

Prometheus scrapes the backend's `/metrics` endpoint. Grafana dashboards are provisioned from `./grafana/dashboards/` and datasources from `./grafana/datasources/`.

## Health Checks

| Service | Endpoint | Method |
|---------|----------|--------|
| Backend | `http://localhost:3001/health` | `curl -f` |
| Frontend | `http://localhost/` | `wget --spider` |
| Postgres | `pg_isready` | CLI command |

## Backup and Recovery

### Database Backup

```bash
docker exec apc-pdu-db pg_dump -U apc_user apc_pdu > backup.sql
```

### Database Restore

```bash
docker exec -i apc-pdu-db psql -U apc_user apc_pdu < backup.sql
```

### Volume Backup

```bash
docker run --rm \
  -v apc-pdu-control_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data
```

## Updating

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Restart with new images
docker-compose -f docker-compose.prod.yml up -d
```

For tagged releases, update `VERSION` in `.env` before pulling.

## Database Migration (Schema Updates)

If upgrading from an older version, manual schema migration may be needed. Example for `display_order`:

```sql
docker exec -it apc-pdu-db psql -U apc_user apc_pdu
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS display_order INTEGER;
UPDATE outlets SET display_order = outlet_number WHERE display_order IS NULL;
CREATE INDEX IF NOT EXISTS idx_outlets_display_order ON outlets(pdu_id, display_order);
```

## Security Considerations

1. **Change all default passwords** in `.env` before deployment
2. **Generate a secure encryption key** with `openssl rand -hex 16`
3. **Use HTTPS** via a reverse proxy (Traefik, Caddy, etc.) with TLS certificates
4. **Network isolation** - PDUs should be on an isolated management VLAN
5. **Access control** - consider placing behind an auth proxy (Authelia, Keycloak, OAuth2 Proxy)
6. **Firewall** - only expose port 80/443 externally; restrict SNMP access to backend host

## Troubleshooting

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Backend can't reach DB | Postgres not healthy yet | Check `docker-compose logs postgres`, wait for healthcheck |
| Frontend shows blank page | API URL misconfigured | In production, Nginx handles routing; verify backend is running |
| SNMP timeouts | Network unreachable | Verify PDU IPs are reachable from the Docker host |
| WebSocket disconnects | Proxy not forwarding upgrade | Ensure Nginx config includes `Upgrade` headers (built into Dockerfile) |
