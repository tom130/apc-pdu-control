import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { db } from './db';
import { pduRoutes } from './routes/pdu.routes';
import { outletRoutes } from './routes/outlet.routes';
import { metricsRoutes } from './routes/metrics.routes';
import { systemRoutes } from './routes/system.routes';
import { websocketHandler } from './services/websocket.service';
import { SchedulerService } from './services/scheduler.service';
import { SNMPService } from './services/snmp.service';
import { StateManager } from './services/state-manager.service';
import { logger } from './utils/logger';

const port = process.env.PORT || 3001;
const host = process.env.HOST || '0.0.0.0';

// Initialize services
const snmpService = new SNMPService();
const stateManager = new StateManager(db, snmpService);
const schedulerService = new SchedulerService(db, snmpService, stateManager);

// Create Elysia app
const app = new Elysia()
  .use(cors({
    origin: true,
    credentials: true,
  }))
  .use(swagger({
    documentation: {
      info: {
        title: 'APC PDU API',
        version: '1.0.0',
        description: 'API for controlling APC Switched Rack PDUs',
      },
    },
  }))
  // WebSocket endpoint
  .ws('/ws', websocketHandler)
  // Store services in context
  .decorate('db', db)
  .decorate('snmpService', snmpService)
  .decorate('stateManager', stateManager)
  // Health check
  .get('/health', () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }))
  // API routes
  .group('/api', (app) =>
    app
      .use(pduRoutes)
      .use(outletRoutes)
      .use(metricsRoutes)
      .use(systemRoutes)
  )
  // Error handling
  .onError(({ code, error, set }) => {
    logger.error({ code, error: error.message }, 'Request error');
    
    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        error: 'Validation Error',
        message: error.message,
      };
    }
    
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return {
        error: 'Not Found',
        message: 'The requested resource was not found',
      };
    }
    
    set.status = 500;
    return {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
    };
  });

app.listen({
  port,
  hostname: host,
});

// Start background services
schedulerService.start();

logger.info(`🚀 APC PDU API is running at http://${host}:${port}`);
logger.info(`📚 Swagger documentation at http://${host}:${port}/swagger`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  schedulerService.stop();
  await app.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  schedulerService.stop();
  await app.stop();
  process.exit(0);
});