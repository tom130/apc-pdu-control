import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { PDU, Outlet, PDUEvent, PowerMetrics, StateReconciliation, SystemHealth } from '@/types/pdu';

interface PDUState {
  // Data
  pdus: PDU[];
  outlets: Record<string, Outlet[]>; // Keyed by PDU ID
  events: PDUEvent[];
  metrics: PowerMetrics[];
  reconciliations: Record<string, StateReconciliation>; // Keyed by PDU ID
  systemHealth: SystemHealth | null;
  
  // UI State
  selectedPduId: string | null;
  isLoading: boolean;
  error: string | null;
  pollingInterval: number;
  
  // Actions
  setPdus: (pdus: PDU[]) => void;
  addPdu: (pdu: PDU) => void;
  updatePdu: (id: string, updates: Partial<PDU>) => void;
  removePdu: (id: string) => void;
  
  setOutlets: (pduId: string, outlets: Outlet[]) => void;
  updateOutlet: (pduId: string, outletId: string, updates: Partial<Outlet>) => void;
  setDesiredState: (pduId: string, outletId: string, state: 'on' | 'off' | 'reboot') => void;
  
  addEvent: (event: PDUEvent) => void;
  clearEvents: (pduId?: string) => void;
  
  addMetrics: (metrics: PowerMetrics) => void;
  
  setReconciliation: (pduId: string, reconciliation: StateReconciliation) => void;
  
  setSystemHealth: (health: SystemHealth) => void;
  
  setSelectedPdu: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPollingInterval: (interval: number) => void;
  
  // Helper methods
  getPduById: (id: string) => PDU | undefined;
  getOutletsByPduId: (pduId: string) => Outlet[];
  getSkewedOutlets: (pduId: string) => Outlet[];
}

const usePDUStore = create<PDUState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        pdus: [],
        outlets: {},
        events: [],
        metrics: [],
        reconciliations: {},
        systemHealth: null,
        selectedPduId: null,
        isLoading: false,
        error: null,
        pollingInterval: 30000, // 30 seconds default
        
        // PDU Actions
        setPdus: (pdus) => set({ pdus }),
        
        addPdu: (pdu) => set((state) => ({ 
          pdus: [...state.pdus, pdu] 
        })),
        
        updatePdu: (id, updates) => set((state) => ({
          pdus: state.pdus.map(pdu => 
            pdu.id === id ? { ...pdu, ...updates } : pdu
          )
        })),
        
        removePdu: (id) => set((state) => ({
          pdus: state.pdus.filter(pdu => pdu.id !== id),
          outlets: Object.fromEntries(
            Object.entries(state.outlets).filter(([pduId]) => pduId !== id)
          )
        })),
        
        // Outlet Actions
        setOutlets: (pduId, outlets) => set((state) => ({
          outlets: { ...state.outlets, [pduId]: outlets }
        })),
        
        updateOutlet: (pduId, outletId, updates) => set((state) => ({
          outlets: {
            ...state.outlets,
            [pduId]: state.outlets[pduId]?.map(outlet =>
              outlet.id === outletId ? { ...outlet, ...updates } : outlet
            ) || []
          }
        })),
        
        setDesiredState: (pduId, outletId, desiredState) => {
          const state = get();
          state.updateOutlet(pduId, outletId, { desiredState });
        },
        
        // Event Actions
        addEvent: (event) => set((state) => ({
          events: [event, ...state.events].slice(0, 100) // Keep last 100 events
        })),
        
        clearEvents: (pduId) => set((state) => ({
          events: pduId 
            ? state.events.filter(e => e.pduId !== pduId)
            : []
        })),
        
        // Metrics Actions
        addMetrics: (metrics) => set((state) => ({
          metrics: [metrics, ...state.metrics].slice(0, 500) // Keep last 500 metrics
        })),
        
        // Reconciliation Actions
        setReconciliation: (pduId, reconciliation) => set((state) => ({
          reconciliations: {
            ...state.reconciliations,
            [pduId]: reconciliation
          }
        })),
        
        // System Health Actions
        setSystemHealth: (health) => set({ systemHealth: health }),
        
        // UI State Actions
        setSelectedPdu: (id) => set({ selectedPduId: id }),
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),
        setPollingInterval: (interval) => set({ pollingInterval: interval }),
        
        // Helper methods
        getPduById: (id) => get().pdus.find(pdu => pdu.id === id),
        
        getOutletsByPduId: (pduId) => get().outlets[pduId] || [],
        
        getSkewedOutlets: (pduId) => {
          const outlets = get().outlets[pduId] || [];
          return outlets.filter(outlet => 
            outlet.desiredState && 
            outlet.actualState && 
            outlet.desiredState !== outlet.actualState
          );
        },
      }),
      {
        name: 'pdu-store',
        partialize: (state) => ({
          pdus: state.pdus,
          pollingInterval: state.pollingInterval,
        }),
      }
    )
  )
);

export default usePDUStore;