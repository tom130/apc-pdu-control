import { logger } from '../utils/logger';

interface WebSocketClient {
  id: string;
  ws: any;
  subscriptions: Set<string>;
}

export class WebSocketService {
  private clients = new Map<string, WebSocketClient>();
  private static instance: WebSocketService;

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  addClient(id: string, ws: any) {
    this.clients.set(id, {
      id,
      ws,
      subscriptions: new Set(['global']),
    });
    logger.info({ clientId: id }, 'WebSocket client connected');
  }

  removeClient(id: string) {
    this.clients.delete(id);
    logger.info({ clientId: id }, 'WebSocket client disconnected');
  }

  subscribe(clientId: string, channel: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.add(channel);
      logger.debug({ clientId, channel }, 'Client subscribed to channel');
    }
  }

  unsubscribe(clientId: string, channel: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.delete(channel);
      logger.debug({ clientId, channel }, 'Client unsubscribed from channel');
    }
  }

  broadcast(event: string, data: any, channel: string = 'global') {
    const message = JSON.stringify({
      type: event,
      channel,
      data,
      timestamp: new Date().toISOString(),
    });

    let sent = 0;
    for (const client of this.clients.values()) {
      if (client.subscriptions.has(channel) || client.subscriptions.has('global')) {
        try {
          client.ws.send(message);
          sent++;
        } catch (error) {
          logger.error({ error, clientId: client.id }, 'Failed to send WebSocket message');
        }
      }
    }

    logger.debug({ event, channel, clients: sent }, 'Broadcast WebSocket message');
  }

  sendToClient(clientId: string, event: string, data: any) {
    const client = this.clients.get(clientId);
    if (client) {
      const message = JSON.stringify({
        type: event,
        data,
        timestamp: new Date().toISOString(),
      });

      try {
        client.ws.send(message);
      } catch (error) {
        logger.error({ error, clientId }, 'Failed to send WebSocket message to client');
      }
    }
  }
}

// WebSocket handler for Elysia
export const websocketHandler = {
  open(ws: any) {
    const clientId = crypto.randomUUID();
    ws.data = { clientId };
    
    const wsService = WebSocketService.getInstance();
    wsService.addClient(clientId, ws);
    
    ws.send(JSON.stringify({
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString(),
    }));
  },
  
  message(ws: any, message: any) {
    const wsService = WebSocketService.getInstance();
    const clientId = ws.data.clientId;
    
    try {
      const parsed = typeof message === 'string' ? JSON.parse(message) : message;
      
      switch (parsed.type) {
        case 'subscribe':
          wsService.subscribe(clientId, parsed.channel);
          break;
        case 'unsubscribe':
          wsService.unsubscribe(clientId, parsed.channel);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;
        default:
          logger.debug({ clientId, message: parsed }, 'Received WebSocket message');
      }
    } catch (error) {
      logger.error({ error, clientId }, 'Failed to parse WebSocket message');
    }
  },
  
  close(ws: any) {
    const wsService = WebSocketService.getInstance();
    const clientId = ws.data?.clientId;
    if (clientId) {
      wsService.removeClient(clientId);
    }
  },
  
  error(ws: any, error: any) {
    logger.error({ error, clientId: ws.data?.clientId }, 'WebSocket error');
  },
};