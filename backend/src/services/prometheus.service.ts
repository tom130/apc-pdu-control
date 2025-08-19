import { Registry, Gauge, Counter, Histogram, collectDefaultMetrics } from 'prom-client';
import { logger } from '../utils/logger';

export class PrometheusService {
  private static instance: PrometheusService;
  private registry: Registry;
  
  // Power metrics
  private powerDrawGauge: Gauge<string>;
  private powerWattsGauge: Gauge<string>;
  private voltageGauge: Gauge<string>;
  private loadStateGauge: Gauge<string>;
  
  // Outlet metrics
  private outletStateGauge: Gauge<string>;
  
  // PDU status metrics
  private pduStatusGauge: Gauge<string>;
  private pduLastSeenGauge: Gauge<string>;
  
  // System metrics
  private stateChangesCounter: Counter<string>;
  private errorsCounter: Counter<string>;
  private snmpRequestDuration: Histogram<string>;
  
  // Polling metrics
  private pollDuration: Histogram<string>;
  private pollErrorsCounter: Counter<string>;

  private constructor() {
    this.registry = new Registry();
    
    // Collect default Node.js metrics (memory, CPU, etc.)
    if (process.env.PROMETHEUS_DEFAULT_METRICS !== 'false') {
      collectDefaultMetrics({ register: this.registry });
    }
    
    // Initialize power metrics
    this.powerDrawGauge = new Gauge({
      name: 'pdu_power_draw_amperes',
      help: 'Current power draw in Amperes',
      labelNames: ['pdu_name', 'pdu_id', 'pdu_ip'],
      registers: [this.registry],
    });
    
    this.powerWattsGauge = new Gauge({
      name: 'pdu_power_consumption_watts',
      help: 'Current power consumption in Watts',
      labelNames: ['pdu_name', 'pdu_id', 'pdu_ip'],
      registers: [this.registry],
    });
    
    this.voltageGauge = new Gauge({
      name: 'pdu_voltage_volts',
      help: 'Current voltage in Volts',
      labelNames: ['pdu_name', 'pdu_id', 'pdu_ip'],
      registers: [this.registry],
    });
    
    this.loadStateGauge = new Gauge({
      name: 'pdu_load_state',
      help: 'Load state (0=normal, 1=low, 2=near_overload, 3=overload)',
      labelNames: ['pdu_name', 'pdu_id', 'pdu_ip', 'state_name'],
      registers: [this.registry],
    });
    
    // Initialize outlet metrics
    this.outletStateGauge = new Gauge({
      name: 'pdu_outlet_state',
      help: 'Outlet state (0=off, 1=on, 2=reboot)',
      labelNames: ['pdu_name', 'pdu_id', 'pdu_ip', 'outlet_name', 'outlet_number'],
      registers: [this.registry],
    });
    
    // Initialize PDU status metrics
    this.pduStatusGauge = new Gauge({
      name: 'pdu_status',
      help: 'PDU online status (0=offline, 1=online)',
      labelNames: ['pdu_name', 'pdu_id', 'pdu_ip'],
      registers: [this.registry],
    });
    
    this.pduLastSeenGauge = new Gauge({
      name: 'pdu_last_seen_timestamp',
      help: 'Last seen timestamp (Unix seconds)',
      labelNames: ['pdu_name', 'pdu_id', 'pdu_ip'],
      registers: [this.registry],
    });
    
    // Initialize system metrics
    this.stateChangesCounter = new Counter({
      name: 'pdu_state_changes_total',
      help: 'Total outlet state changes',
      labelNames: ['pdu_name', 'pdu_id', 'outlet_name', 'outlet_number', 'change_type', 'from_state', 'to_state'],
      registers: [this.registry],
    });
    
    this.errorsCounter = new Counter({
      name: 'pdu_errors_total',
      help: 'Total errors by type',
      labelNames: ['pdu_name', 'pdu_id', 'error_type', 'operation'],
      registers: [this.registry],
    });
    
    this.snmpRequestDuration = new Histogram({
      name: 'pdu_snmp_request_duration_seconds',
      help: 'SNMP request duration in seconds',
      labelNames: ['pdu_name', 'pdu_id', 'operation'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });
    
    // Initialize polling metrics
    this.pollDuration = new Histogram({
      name: 'pdu_poll_duration_seconds',
      help: 'PDU polling duration in seconds',
      labelNames: ['pdu_name', 'pdu_id'],
      buckets: [0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });
    
    this.pollErrorsCounter = new Counter({
      name: 'pdu_poll_errors_total',
      help: 'Total polling errors',
      labelNames: ['pdu_name', 'pdu_id', 'error_type'],
      registers: [this.registry],
    });
    
    logger.info('Prometheus metrics service initialized');
  }
  
  static getInstance(): PrometheusService {
    if (!PrometheusService.instance) {
      PrometheusService.instance = new PrometheusService();
    }
    return PrometheusService.instance;
  }
  
  // Update power metrics
  updatePowerMetrics(pdu: any, metrics: any) {
    const labels = {
      pdu_name: pdu.name,
      pdu_id: pdu.id,
      pdu_ip: pdu.ipAddress,
    };
    
    this.powerDrawGauge.set(labels, metrics.totalPowerDraw);
    this.powerWattsGauge.set(labels, metrics.totalPowerWatts);
    this.voltageGauge.set(labels, metrics.voltage);
    
    // Map load state to numeric value
    const loadStateMap: Record<string, number> = {
      'normal': 0,
      'low': 1,
      'near_overload': 2,
      'overload': 3,
    };
    
    this.loadStateGauge.set(
      { ...labels, state_name: metrics.loadState },
      loadStateMap[metrics.loadState] || 0
    );
  }
  
  // Update outlet states
  updateOutletStates(pdu: any, outlets: any[]) {
    const pduLabels = {
      pdu_name: pdu.name,
      pdu_id: pdu.id,
      pdu_ip: pdu.ipAddress,
    };
    
    for (const outlet of outlets) {
      const labels = {
        ...pduLabels,
        outlet_name: outlet.name || `Outlet ${outlet.outletNumber}`,
        outlet_number: outlet.outletNumber.toString(),
      };
      
      // Map outlet state to numeric value
      const stateMap: Record<string, number> = {
        'off': 0,
        'on': 1,
        'reboot': 2,
      };
      
      this.outletStateGauge.set(labels, stateMap[outlet.state] || 0);
    }
  }
  
  // Update PDU status
  updatePDUStatus(pdu: any, status: 'online' | 'offline') {
    const labels = {
      pdu_name: pdu.name,
      pdu_id: pdu.id,
      pdu_ip: pdu.ipAddress,
    };
    
    this.pduStatusGauge.set(labels, status === 'online' ? 1 : 0);
    
    if (status === 'online') {
      this.pduLastSeenGauge.set(labels, Date.now() / 1000);
    }
  }
  
  // Record state change
  recordStateChange(pdu: any, outlet: any, changeType: string, fromState: string, toState: string) {
    this.stateChangesCounter.inc({
      pdu_name: pdu.name,
      pdu_id: pdu.id,
      outlet_name: outlet.name || `Outlet ${outlet.outletNumber}`,
      outlet_number: outlet.outletNumber?.toString() || outlet.outlet_number?.toString(),
      change_type: changeType,
      from_state: fromState,
      to_state: toState,
    });
  }
  
  // Record error
  recordError(pdu: any, errorType: string, operation: string) {
    this.errorsCounter.inc({
      pdu_name: pdu.name,
      pdu_id: pdu.id,
      error_type: errorType,
      operation: operation,
    });
  }
  
  // Start SNMP request timer
  startSNMPTimer(pdu: any, operation: string) {
    return this.snmpRequestDuration.startTimer({
      pdu_name: pdu.name,
      pdu_id: pdu.id,
      operation: operation,
    });
  }
  
  // Start poll timer
  startPollTimer(pdu: any) {
    return this.pollDuration.startTimer({
      pdu_name: pdu.name,
      pdu_id: pdu.id,
    });
  }
  
  // Record poll error
  recordPollError(pdu: any, errorType: string) {
    this.pollErrorsCounter.inc({
      pdu_name: pdu.name,
      pdu_id: pdu.id,
      error_type: errorType,
    });
  }
  
  // Get metrics in Prometheus format
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
  
  // Get metrics content type
  getContentType(): string {
    return this.registry.contentType;
  }
  
  // Reset all metrics (useful for testing)
  reset() {
    this.registry.clear();
  }
}