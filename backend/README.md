# APC PDU Backend

Backend service for APC Switched Rack PDU control panel, built with Bun and Elysia framework.

## Features

- **SNMP Communication**: Support for SNMPv1, SNMPv2c, and SNMPv3 protocols
- **State Management**: Desired vs Actual state tracking with automatic reconciliation
- **Reboot Recovery**: Automatic detection and recovery from PDU reboots
- **Real-time Updates**: WebSocket support for live state changes
- **Power Monitoring**: Real-time power consumption in Amps and Watts (EU 230V standard)
- **Scheduled Operations**: Schedule outlet operations for future execution
- **Metrics & Events**: Track power metrics and system events
- **Secure Credentials**: Encrypted storage of SNMP credentials
- **AP7951 Support**: Full compatibility with older 1G PDUs

## Tech Stack

- **Runtime**: Bun
- **Framework**: Elysia
- **Database**: PostgreSQL with Drizzle ORM
- **Protocol**: SNMP (v1/v2c/v3)
- **Real-time**: WebSocket
- **Container**: Docker

## Prerequisites

- Bun 1.0+ or Docker
- PostgreSQL 16+
- net-snmp utilities (for SNMP operations)

## Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd apc-pdu-backend
```

2. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start all services:
```bash
make docker-up
# or
docker-compose up -d
```

4. The backend will be available at `http://localhost:3001`

### Local Development

1. Install dependencies:
```bash
bun install
```

2. Start PostgreSQL:
```bash
make services
# or manually start PostgreSQL
```

3. Run database migrations:
```bash
bun run db:migrate
```

4. Start development server:
```bash
bun run dev
```

## API Documentation

The API documentation is available via Swagger UI at:
```
http://localhost:3001/swagger
```

### Main Endpoints

#### PDU Management
- `GET /api/pdus` - List all PDUs
- `POST /api/pdus` - Add new PDU
- `GET /api/pdus/:id` - Get PDU details
- `PUT /api/pdus/:id` - Update PDU
- `DELETE /api/pdus/:id` - Delete PDU
- `POST /api/pdus/:id/test` - Test PDU connection
- `POST /api/pdus/:id/reconcile` - Reconcile PDU state
- `POST /api/pdus/:id/recover` - Recover from PDU reboot

#### Outlet Control
- `GET /api/pdus/:pduId/outlets` - List outlets
- `GET /api/pdus/:pduId/outlets/:outletId` - Get outlet details
- `PUT /api/pdus/:pduId/outlets/:outletId` - Update outlet settings
- `POST /api/pdus/:pduId/outlets/:outletId/power` - Control outlet power
- `POST /api/pdus/:pduId/outlets/:outletId/desired-state` - Set desired state
- `GET /api/pdus/:pduId/outlets/:outletId/history` - Get state history
- `POST /api/pdus/:pduId/outlets/bulk` - Bulk outlet operations

#### Metrics & Monitoring
- `GET /api/pdus/:pduId/metrics` - Get historical metrics
- `GET /api/pdus/:pduId/metrics/current` - Get current metrics
- `GET /api/pdus/:pduId/events` - Get PDU events
- `GET /api/system/health` - System health check
- `GET /api/events` - Get all system events

#### Scheduled Operations
- `GET /api/scheduled-operations` - List scheduled operations
- `POST /api/scheduled-operations` - Schedule new operation
- `DELETE /api/scheduled-operations/:id` - Cancel scheduled operation

### WebSocket

Connect to WebSocket for real-time updates:
```
ws://localhost:3001/ws
```

Events:
- `outlet:state-changed` - Outlet state change
- `outlets:bulk-changed` - Bulk outlet operation
- `pdu:status-changed` - PDU status change
- `pdu:reboot-detected` - PDU reboot detected
- `state:reconciled` - State reconciliation complete

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

Key configurations:
- `DATABASE_URL` - PostgreSQL connection string
- `STATE_RECONCILIATION_INTERVAL` - How often to reconcile states (ms)
- `PDU_POLLING_INTERVAL` - How often to poll PDUs (ms)
- `REBOOT_DETECTION_THRESHOLD` - Number of outlets that must change to detect reboot
- `ENCRYPTION_KEY` - 32-character key for encrypting SNMP credentials

### SNMP Configuration

#### Protocol Support
- **SNMPv1**: Community string authentication (legacy PDUs)
- **SNMPv2c**: Community string with better performance
- **SNMPv3**: User-based security with authentication and encryption

#### SNMPv3 Security Levels
- `noAuthNoPriv` - No authentication, no privacy (default for APC PDUs)
- `authNoPriv` - Authentication only
- `authPriv` - Authentication and privacy (recommended for security)

#### Supported Algorithms
- Authentication: MD5, SHA
- Privacy: DES, AES

#### Community Strings (v1/v2c)
- Read operations: `public` (default)
- Write operations: `private` (default)

#### Power Monitoring
- Displays power consumption in Amps and Watts
- EU standard 230V calculation
- Note: Some older PDUs may not support power monitoring

## Development

### Project Structure

```
src/
├── index.ts              # Main server entry point
├── config/              # Configuration files
├── db/                  # Database schema and migrations
├── routes/              # API route handlers
├── services/            # Business logic services
├── utils/               # Utility functions
└── websocket/           # WebSocket handlers
```

### Available Commands

```bash
# Development
make dev              # Start development server
make test            # Run tests
make build           # Build for production

# Docker
make docker-up       # Start all services
make docker-down     # Stop all services
make docker-logs     # View logs
make docker-clean    # Clean up containers and volumes

# Database
make db-migrate      # Run migrations
make db-seed        # Seed sample data

# Utilities
make services        # Start PostgreSQL
make fullstack      # Start frontend and backend together
make pgadmin        # Start pgAdmin interface
```

### Testing SNMP

To test SNMP connectivity without a physical PDU, you can use `snmpsimd`:

```bash
# Install snmpsimd
pip install snmpsimd

# Run simulator
snmpsimd --data-dir=./test/snmp-data --agent-udpv4-endpoint=127.0.0.1:161
```

## Deployment

### Docker Production Build

```bash
# Build production image
docker build -t apc-pdu-backend:latest .

# Run container
docker run -d \
  --name apc-pdu-backend \
  -p 3001:3001 \
  --env-file .env \
  apc-pdu-backend:latest
```

### Kubernetes Deployment

See `k8s/` directory for Kubernetes manifests (if available).

## Security Considerations

- SNMP credentials are encrypted in the database
- Use SNMPv3 with authentication and privacy
- Configure CORS appropriately for production
- Use HTTPS in production (terminate at ingress/proxy)
- Rotate encryption keys regularly
- Implement rate limiting for API endpoints

## Troubleshooting

### SNMP Connection Issues

1. Verify PDU IP is reachable:
```bash
ping <pdu-ip>
```

2. Test SNMP connectivity:

For SNMPv1/v2c:
```bash
snmpwalk -v1 -c public <pdu-ip>
snmpwalk -v2c -c public <pdu-ip>
```

For SNMPv3:
```bash
snmpwalk -v3 -u <username> -l authPriv -a SHA -A <auth-pass> -x AES -X <priv-pass> <pdu-ip>
```

3. Check firewall rules (SNMP uses UDP port 161)

### Database Connection Issues

1. Check PostgreSQL is running:
```bash
docker-compose ps postgres
```

2. Verify connection:
```bash
psql postgresql://apc_user:apc_password@localhost:5432/apc_pdu
```

### State Skew Issues

If outlets are showing incorrect states:

1. Manually reconcile:
```bash
curl -X POST http://localhost:3001/api/pdus/<pdu-id>/reconcile
```

2. Check reconciliation logs:
```bash
docker-compose logs backend | grep reconcile
```

### Power Monitoring Issues

If power metrics are not displaying:

1. Verify PDU supports power monitoring (not all older models do):
```bash
# Check if power OIDs respond
snmpget -v1 -c public <pdu-ip> 1.3.6.1.4.1.318.1.1.12.2.3.1.1.2.1
```

2. For AP7951 and similar 1G PDUs:
   - Power metrics use indexed OIDs (append .1 to base OID)
   - Only total power consumption is available (not per-outlet)
   - Values are returned in tenths of amps

3. Check backend logs for SNMP errors:
```bash
docker-compose logs backend | grep -E "Power metrics|SNMP"
```

### Common PDU Models

- **AP7951**: 1G PDU with 24 outlets, SNMPv1, power monitoring supported
- **AP7920**: 1G PDU with 8 outlets, basic power monitoring
- **AP84XX/86XX/88XX**: 2G PDUs with full per-outlet monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT