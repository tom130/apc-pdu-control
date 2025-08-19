# APC PDU Control Panel

A modern React-based web application for managing and controlling APC Switched Rack PDUs with state management and PostgreSQL backend.

## Features

### Core Functionality
- **Real-time PDU Monitoring**: Monitor multiple APC PDUs simultaneously
- **Outlet Control**: Individual and bulk control of power outlets (ON/OFF/REBOOT)
- **State Management**: PostgreSQL-backed state persistence with automatic reconciliation
- **Reboot Recovery**: Automatic state recovery after PDU reboots
- **State Skew Detection**: Identifies and corrects discrepancies between desired and actual states
- **Power Metrics**: Real-time power consumption monitoring and load state tracking
- **Event Logging**: Comprehensive event history with export capabilities

### Technical Features
- **SNMPv3 Support**: Secure communication with PDUs using SNMPv3
- **Real-time Updates**: WebSocket support for instant state changes
- **Kubernetes Ready**: Designed for K8s deployment with Authelia authentication
- **Dark Mode**: Full dark mode support with shadcn/ui components
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **UI Components**: shadcn/ui, Tailwind CSS
- **State Management**: Zustand
- **API Client**: Axios, React Query
- **Routing**: React Router v6
- **Database**: PostgreSQL
- **Authentication**: Authelia (via Kubernetes ingress)

## Project Structure

```
src/
├── api/          # API client services
├── components/   # React components
│   ├── layout/   # Layout components (Header, Sidebar)
│   ├── pdu/      # PDU-specific components
│   └── ui/       # shadcn/ui components
├── hooks/        # Custom React hooks
├── lib/          # Utilities
├── pages/        # Page components
├── services/     # SNMP and other services
├── store/        # Zustand state management
└── types/        # TypeScript type definitions

database/         # PostgreSQL schema
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Backend API service (separate repository)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd apc-pdu-fe
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API endpoint
```

4. Set up the database:
```bash
psql -U postgres -f database/schema.sql
```

5. Start the development server:
```bash
npm run dev
```

## Configuration

### Environment Variables
- `VITE_API_URL`: Backend API endpoint (default: `/api`)

### SNMP Configuration
PDUs require SNMPv3 configuration with:
- User Profile
- Authentication Protocol (MD5/SHA)
- Authentication Passphrase (15-32 characters)
- Privacy Protocol (DES/AES)
- Privacy Passphrase (15-32 characters)
- Security Level (authPriv recommended)

## State Management Architecture

The application maintains ownership of outlet states through:

1. **Desired State**: What the application wants the outlet state to be
2. **Actual State**: Current state reported by the PDU
3. **Reconciliation**: Automatic correction of state skew
4. **Recovery**: Restoration of desired states after PDU reboot

### State Reconciliation Process
- Polls PDUs every 30 seconds
- Compares actual vs desired states
- Detects PDU reboots
- Applies corrections with retry logic
- Logs all state changes

## API Endpoints

The frontend expects these backend endpoints:

- `GET /api/pdus` - List all PDUs
- `GET /api/pdus/:id` - Get PDU details
- `POST /api/pdus` - Add new PDU
- `GET /api/pdus/:id/outlets` - Get outlets
- `POST /api/pdus/:id/outlets/:outletId/power` - Control outlet
- `POST /api/pdus/:id/outlets/:outletId/desired-state` - Set desired state
- `POST /api/pdus/:id/reconcile` - Force reconciliation
- `GET /api/pdus/:id/metrics` - Get power metrics
- `GET /api/system/health` - System health status

## Deployment

### Kubernetes Deployment
The application is designed to run in Kubernetes with:
- Authelia for authentication
- PostgreSQL for state persistence
- Backend API service for SNMP communication

### Production Build
```bash
npm run build
```

The built files will be in the `dist/` directory.

## Security

- Authentication handled by Authelia at ingress level
- SNMP credentials encrypted in backend
- No sensitive data stored in frontend
- HTTPS required for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC License

## Acknowledgments

Based on the PHP implementation by Roberto Di Sisto:
- https://github.com/disisto/apc-switched-rack-pdu-control-panel

SNMP library reference:
- https://github.com/phillipsnick/apc-pdu-snmp