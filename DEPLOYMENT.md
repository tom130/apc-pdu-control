# APC PDU Control - Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database (or use the included container)
- Access to your PDUs via SNMP

## Quick Start

### 1. Using Pre-built Images (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/apc-pdu-control.git
cd apc-pdu-control

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your settings

# Start the application
docker-compose -f docker-compose.prod.yml up -d
```

### 2. Building from Source

```bash
# Build images locally
docker-compose -f docker-compose.prod.yml build

# Start the application
docker-compose -f docker-compose.prod.yml up -d
```

## Container Images

Images are automatically built and published to GitHub Container Registry:

- Backend: `ghcr.io/yourusername/apc-pdu-control-backend:latest`
- Frontend: `ghcr.io/yourusername/apc-pdu-control-frontend:latest`

### Available Tags

- `latest` - Latest stable release
- `v1.0.0` - Specific version
- `main-sha` - Specific commit

### Multi-Architecture Support

Images support both `linux/amd64` and `linux/arm64` architectures.

## Configuration

### Essential Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_USER` | PostgreSQL username | `apc_user` |
| `DB_PASSWORD` | PostgreSQL password | **Required** |
| `ENCRYPTION_KEY` | 32-character encryption key | **Required** |
| `CORS_ORIGIN` | Frontend URL for CORS | `http://localhost` |

### Database Initialization

The database schema is automatically initialized on first run from:
`backend/database/schema.sql`

This includes:
- PDU and outlet tables
- Power metrics tracking
- Event logging
- Display order support for outlet reorganization

## Deployment Options

### Option 1: Docker Compose (Recommended)

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Kubernetes

Use the provided images with your Kubernetes manifests:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: apc-pdu-backend
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: backend
        image: ghcr.io/yourusername/apc-pdu-control-backend:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: apc-pdu-secrets
              key: database-url
```

### Option 3: Docker Swarm

```bash
docker stack deploy -c docker-compose.prod.yml apc-pdu
```

## Monitoring

Enable monitoring stack with Prometheus and Grafana:

```bash
docker-compose -f docker-compose.prod.yml --profile monitoring up -d
```

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

## Security Considerations

1. **Change Default Passwords**: Update all passwords in `.env`
2. **Generate Encryption Key**: Use `openssl rand -hex 16` for production
3. **Use HTTPS**: Put behind a reverse proxy with SSL certificates
4. **Network Isolation**: PDUs should be on an isolated management network
5. **Access Control**: Implement authentication (Authelia, Keycloak, etc.)

## Backup and Recovery

### Database Backup

```bash
# Backup
docker exec apc-pdu-db pg_dump -U apc_user apc_pdu > backup.sql

# Restore
docker exec -i apc-pdu-db psql -U apc_user apc_pdu < backup.sql
```

### Volume Backup

```bash
# Backup volumes
docker run --rm -v apc-pdu-control_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

## Troubleshooting

### Check Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Database Migration

If updating from an older version without `display_order`:

```sql
-- Connect to database
docker exec -it apc-pdu-db psql -U apc_user apc_pdu

-- Add display_order column if missing
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS display_order INTEGER;
UPDATE outlets SET display_order = outlet_number WHERE display_order IS NULL;
CREATE INDEX IF NOT EXISTS idx_outlets_display_order ON outlets(pdu_id, display_order);
```

### Health Checks

```bash
# Backend health
curl http://localhost:3001/health

# Frontend health
curl http://localhost/

# Database health
docker exec apc-pdu-db pg_isready
```

## Updating

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Restart with new images
docker-compose -f docker-compose.prod.yml up -d
```

## Support

For issues and feature requests, please use the GitHub issue tracker.