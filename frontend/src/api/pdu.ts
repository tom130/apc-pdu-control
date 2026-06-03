import axios, { AxiosInstance } from 'axios';
import type {
  PDU,
  Outlet,
  OutletState,
  OutletOperation,
  PDUEvent,
  PowerMetrics,
  OutletStateHistory,
  SystemHealth,
  ScheduledOperation,
  CronSchedule,
  OutletSchedules,
  ApiKey
} from '@/types/pdu';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface WsEnvelope<T = any> {
  type: string;
  channel?: string;
  data: T;
  timestamp?: string;
}

export function normalizeWsEvent(message: any): WsEnvelope {
  if (message && typeof message === 'object' && 'data' in message) {
    return message as WsEnvelope;
  }

  return {
    type: message?.type ?? 'unknown',
    data: message,
    timestamp: message?.timestamp,
  };
}

class PDUApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth headers (Authelia will handle this)
    this.client.interceptors.request.use(
      (config) => {
        // Auth headers will be added by Authelia/K8s ingress
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Redirect to auth if needed
          window.location.href = '/auth/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // PDU Management
  async getPDUs(): Promise<PDU[]> {
    const response = await this.client.get<PDU[]>('/pdus');
    return response.data;
  }

  async getPDU(id: string): Promise<PDU> {
    const response = await this.client.get<PDU>(`/pdus/${id}`);
    return response.data;
  }

  async createPDU(pdu: Omit<PDU, 'id' | 'createdAt' | 'updatedAt'>): Promise<PDU> {
    const response = await this.client.post<PDU>('/pdus', pdu);
    return response.data;
  }

  async updatePDU(id: string, updates: Partial<PDU>): Promise<PDU> {
    const response = await this.client.put<PDU>(`/pdus/${id}`, updates);
    return response.data;
  }

  async deletePDU(id: string): Promise<void> {
    await this.client.delete(`/pdus/${id}`);
  }

  async testPDUConnection(id: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post<{ success: boolean; message: string }>(
      `/pdus/${id}/test`
    );
    return response.data;
  }

  // Outlet Management
  async getOutlets(pduId: string): Promise<Outlet[]> {
    const response = await this.client.get<Outlet[]>(`/pdus/${pduId}/outlets`);
    return response.data;
  }

  async getOutlet(pduId: string, outletId: string): Promise<Outlet> {
    const response = await this.client.get<Outlet>(`/pdus/${pduId}/outlets/${outletId}`);
    return response.data;
  }

  async updateOutlet(pduId: string, outletId: string, updates: Partial<Outlet>): Promise<Outlet> {
    const response = await this.client.put<Outlet>(
      `/pdus/${pduId}/outlets/${outletId}`,
      updates
    );
    return response.data;
  }

  // Outlet Power Control
  async setOutletPower(
    pduId: string,
    outletId: string,
    state: OutletOperation
  ): Promise<{ success: boolean; newState: OutletState }> {
    const response = await this.client.post<{ success: boolean; newState: OutletState }>(
      `/pdus/${pduId}/outlets/${outletId}/power`,
      { state }
    );
    return response.data;
  }

  async bulkOutletControl(
    pduId: string,
    operation: OutletOperation
  ): Promise<{ success: boolean; affected: number }> {
    const response = await this.client.post<{ success: boolean; affected: number }>(
      `/pdus/${pduId}/outlets/bulk`,
      { operation }
    );
    return response.data;
  }

  async reorderOutlets(pduId: string, outletIds: string[]): Promise<Outlet[]> {
    const response = await this.client.put<Outlet[]>(
      `/pdus/${pduId}/outlets/reorder`,
      { outletIds }
    );
    return response.data;
  }

  async resetOutletOrder(pduId: string): Promise<Outlet[]> {
    const response = await this.client.put<Outlet[]>(
      `/pdus/${pduId}/outlets/reset-order`
    );
    return response.data;
  }

  // State History
  async getOutletHistory(
    pduId: string,
    outletId: string,
    limit = 50
  ): Promise<OutletStateHistory[]> {
    const response = await this.client.get<OutletStateHistory[]>(
      `/pdus/${pduId}/outlets/${outletId}/history`,
      { params: { limit } }
    );
    return response.data;
  }

  // Events
  async getPDUEvents(pduId: string, limit = 100): Promise<PDUEvent[]> {
    const response = await this.client.get<PDUEvent[]>(`/pdus/${pduId}/events`, {
      params: { limit },
    });
    return response.data;
  }

  async getAllEvents(limit = 100): Promise<PDUEvent[]> {
    const response = await this.client.get<PDUEvent[]>('/events', {
      params: { limit },
    });
    return response.data;
  }

  // Power Metrics
  async getPowerMetrics(
    pduId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PowerMetrics[]> {
    const response = await this.client.get<PowerMetrics[]>(`/pdus/${pduId}/metrics`, {
      params: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
    });
    return response.data;
  }

  async getCurrentPowerMetrics(pduId: string): Promise<PowerMetrics> {
    const response = await this.client.get<PowerMetrics>(`/pdus/${pduId}/metrics/current`);
    return response.data;
  }

  // Schedules
  async getOutletSchedules(outletId: string): Promise<OutletSchedules> {
    const response = await this.client.get<OutletSchedules>(`/schedules/outlet/${outletId}`);
    return response.data;
  }

  async createCronSchedule(data: {
    outletId: string;
    name: string;
    cronExpression: string;
    operation: OutletOperation;
  }): Promise<CronSchedule> {
    const response = await this.client.post<CronSchedule>('/schedules/cron', data);
    return response.data;
  }

  async updateCronSchedule(id: string, updates: {
    name?: string;
    cronExpression?: string;
    operation?: OutletOperation;
    isActive?: boolean;
  }): Promise<CronSchedule> {
    const response = await this.client.put<CronSchedule>(`/schedules/cron/${id}`, updates);
    return response.data;
  }

  async deleteCronSchedule(id: string): Promise<void> {
    await this.client.delete(`/schedules/cron/${id}`);
  }

  async createOneTimeSchedule(data: {
    outletId: string;
    operation: OutletOperation;
    scheduledTime: string;
  }): Promise<ScheduledOperation> {
    const response = await this.client.post<ScheduledOperation>('/schedules/one-time', data);
    return response.data;
  }

  async deleteOneTimeSchedule(id: string): Promise<void> {
    await this.client.delete(`/schedules/one-time/${id}`);
  }

  // System Health
  async getSystemHealth(): Promise<SystemHealth> {
    const response = await this.client.get<SystemHealth>('/system/health');
    return response.data;
  }

  // API Keys
  async getApiKeys(): Promise<ApiKey[]> {
    const response = await this.client.get<ApiKey[]>('/api-keys');
    return response.data;
  }

  async createApiKey(name: string): Promise<ApiKey> {
    const response = await this.client.post<ApiKey>('/api-keys', { name });
    return response.data;
  }

  async updateApiKey(id: string, updates: { name?: string; isActive?: boolean }): Promise<ApiKey> {
    const response = await this.client.put<ApiKey>(`/api-keys/${id}`, updates);
    return response.data;
  }

  async deleteApiKey(id: string): Promise<void> {
    await this.client.delete(`/api-keys/${id}`);
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (message: WsEnvelope) => void): WebSocket {
    const wsBase = API_BASE_URL.replace(/\/api$/, '').replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws`;
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(normalizeWsEvent(data));
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return ws;
  }
}

export const pduApi = new PDUApiClient();
