import axios, { AxiosInstance } from 'axios';
import type { 
  PDU, 
  Outlet, 
  OutletState,
  PDUEvent, 
  PowerMetrics, 
  OutletStateHistory,
  SystemHealth,
  ScheduledOperation 
} from '@/types/pdu';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
    state: OutletState
  ): Promise<{ success: boolean; newState: OutletState }> {
    const response = await this.client.post<{ success: boolean; newState: OutletState }>(
      `/pdus/${pduId}/outlets/${outletId}/power`,
      { state }
    );
    return response.data;
  }

  async setDesiredState(
    pduId: string,
    outletId: string,
    state: OutletState
  ): Promise<Outlet> {
    const response = await this.client.post<Outlet>(
      `/pdus/${pduId}/outlets/${outletId}/desired-state`,
      { state }
    );
    return response.data;
  }

  async bulkOutletControl(
    pduId: string,
    operation: 'on' | 'off' | 'reboot'
  ): Promise<{ success: boolean; affected: number }> {
    const response = await this.client.post<{ success: boolean; affected: number }>(
      `/pdus/${pduId}/outlets/bulk`,
      { operation }
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

  // State Reconciliation
  async reconcilePDUState(pduId: string): Promise<{
    success: boolean;
    reconciled: number;
    failed: number;
  }> {
    const response = await this.client.post<{
      success: boolean;
      reconciled: number;
      failed: number;
    }>(`/pdus/${pduId}/reconcile`);
    return response.data;
  }

  async recoverFromReboot(pduId: string): Promise<{
    success: boolean;
    recovered: number;
    failed: number;
  }> {
    const response = await this.client.post<{
      success: boolean;
      recovered: number;
      failed: number;
    }>(`/pdus/${pduId}/recover`);
    return response.data;
  }

  // Scheduled Operations
  async getScheduledOperations(outletId?: string): Promise<ScheduledOperation[]> {
    const response = await this.client.get<ScheduledOperation[]>('/scheduled-operations', {
      params: { outletId },
    });
    return response.data;
  }

  async createScheduledOperation(
    operation: Omit<ScheduledOperation, 'id' | 'createdAt' | 'executed'>
  ): Promise<ScheduledOperation> {
    const response = await this.client.post<ScheduledOperation>(
      '/scheduled-operations',
      operation
    );
    return response.data;
  }

  async deleteScheduledOperation(id: string): Promise<void> {
    await this.client.delete(`/scheduled-operations/${id}`);
  }

  // System Health
  async getSystemHealth(): Promise<SystemHealth> {
    const response = await this.client.get<SystemHealth>('/system/health');
    return response.data;
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (data: any) => void): WebSocket {
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
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