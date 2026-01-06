import { pgTable, uuid, text, boolean, timestamp, integer, decimal, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// PDU table
export const pdus = pgTable('pdus', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ipAddress: text('ip_address').notNull().unique(),
  model: text('model'),
  snmpVersion: text('snmp_version').default('v3'),
  snmpUser: text('snmp_user'),
  snmpAuthProtocol: text('snmp_auth_protocol'),
  snmpAuthPassphrase: text('snmp_auth_passphrase'), // Encrypted
  snmpPrivProtocol: text('snmp_priv_protocol'),
  snmpPrivPassphrase: text('snmp_priv_passphrase'), // Encrypted
  snmpSecurityLevel: text('snmp_security_level'),
  isActive: boolean('is_active').default(true),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    ipAddressIdx: index('idx_pdus_ip_address').on(table.ipAddress),
    isActiveIdx: index('idx_pdus_is_active').on(table.isActive),
  };
});

// Outlets table
export const outlets = pgTable('outlets', {
  id: uuid('id').primaryKey().defaultRandom(),
  pduId: uuid('pdu_id').notNull().references(() => pdus.id, { onDelete: 'cascade' }),
  outletNumber: integer('outlet_number').notNull(),
  name: text('name'),
  description: text('description'),
  displayOrder: integer('display_order'),
  desiredState: text('desired_state'), // 'on', 'off', 'reboot'
  actualState: text('actual_state'), // 'on', 'off', 'reboot'
  lastStateChange: timestamp('last_state_change', { withTimezone: true }),
  isCritical: boolean('is_critical').default(false),
  autoRecovery: boolean('auto_recovery').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    pduOutletUnique: uniqueIndex('unique_pdu_outlet').on(table.pduId, table.outletNumber),
    pduIdIdx: index('idx_outlets_pdu_id').on(table.pduId),
    desiredStateIdx: index('idx_outlets_desired_state').on(table.desiredState),
    actualStateIdx: index('idx_outlets_actual_state').on(table.actualState),
    displayOrderIdx: index('idx_outlets_display_order').on(table.pduId, table.displayOrder),
  };
});

// Outlet state history
export const outletStateHistory = pgTable('outlet_state_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  previousState: text('previous_state'),
  newState: text('new_state'),
  changeType: text('change_type'), // 'manual', 'auto_recovery', 'pdu_reboot', 'sync'
  initiatedBy: text('initiated_by'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
  success: boolean('success').default(false),
  errorMessage: text('error_message'),
}, (table) => {
  return {
    outletIdIdx: index('idx_outlet_state_history_outlet_id').on(table.outletId),
    timestampIdx: index('idx_outlet_state_history_timestamp').on(table.timestamp),
  };
});

// PDU events
export const pduEvents = pgTable('pdu_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  pduId: uuid('pdu_id').notNull().references(() => pdus.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(), // 'reboot', 'connection_lost', 'connection_restored', 'state_skew'
  description: text('description'),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    pduIdIdx: index('idx_pdu_events_pdu_id').on(table.pduId),
    timestampIdx: index('idx_pdu_events_timestamp').on(table.timestamp),
  };
});

// Power metrics
export const powerMetrics = pgTable('power_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  pduId: uuid('pdu_id').notNull().references(() => pdus.id, { onDelete: 'cascade' }),
  totalPowerDraw: decimal('total_power_draw', { precision: 10, scale: 2 }), // Amperes
  totalPowerWatts: integer('total_power_watts'), // Watts (230V × Amps for EU)
  voltage: integer('voltage').default(230), // EU standard voltage
  loadState: text('load_state'), // 'normal', 'low', 'near_overload', 'overload'
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    pduIdIdx: index('idx_power_metrics_pdu_id').on(table.pduId),
    timestampIdx: index('idx_power_metrics_timestamp').on(table.timestamp),
  };
});

// Scheduled operations
export const scheduledOperations = pgTable('scheduled_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
  operation: text('operation').notNull(), // 'on', 'off', 'reboot'
  scheduledTime: timestamp('scheduled_time', { withTimezone: true }).notNull(),
  executed: boolean('executed').default(false),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    outletIdIdx: index('idx_scheduled_operations_outlet_id').on(table.outletId),
    scheduledTimeIdx: index('idx_scheduled_operations_scheduled_time').on(table.scheduledTime),
    executedIdx: index('idx_scheduled_operations_executed').on(table.executed),
  };
});

// API Keys for M2M authentication
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(), // For quick lookup (first 8 chars of key)
  encryptedKey: text('encrypted_key').notNull(), // Full key, encrypted
  isActive: boolean('is_active').default(true),
  lastUsed: timestamp('last_used', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    keyHashIdx: index('idx_api_keys_key_hash').on(table.keyHash),
    isActiveIdx: index('idx_api_keys_is_active').on(table.isActive),
  };
});

// Relations
export const pdusRelations = relations(pdus, ({ many }) => ({
  outlets: many(outlets),
  events: many(pduEvents),
  metrics: many(powerMetrics),
}));

export const outletsRelations = relations(outlets, ({ one, many }) => ({
  pdu: one(pdus, {
    fields: [outlets.pduId],
    references: [pdus.id],
  }),
  stateHistory: many(outletStateHistory),
  scheduledOperations: many(scheduledOperations),
}));

export const outletStateHistoryRelations = relations(outletStateHistory, ({ one }) => ({
  outlet: one(outlets, {
    fields: [outletStateHistory.outletId],
    references: [outlets.id],
  }),
}));

export const pduEventsRelations = relations(pduEvents, ({ one }) => ({
  pdu: one(pdus, {
    fields: [pduEvents.pduId],
    references: [pdus.id],
  }),
}));

export const powerMetricsRelations = relations(powerMetrics, ({ one }) => ({
  pdu: one(pdus, {
    fields: [powerMetrics.pduId],
    references: [pdus.id],
  }),
}));

export const scheduledOperationsRelations = relations(scheduledOperations, ({ one }) => ({
  outlet: one(outlets, {
    fields: [scheduledOperations.outletId],
    references: [outlets.id],
  }),
}));

// Types
export type PDU = typeof pdus.$inferSelect;
export type NewPDU = typeof pdus.$inferInsert;
export type Outlet = typeof outlets.$inferSelect;
export type NewOutlet = typeof outlets.$inferInsert;
export type OutletStateHistory = typeof outletStateHistory.$inferSelect;
export type NewOutletStateHistory = typeof outletStateHistory.$inferInsert;
export type PDUEvent = typeof pduEvents.$inferSelect;
export type NewPDUEvent = typeof pduEvents.$inferInsert;
export type PowerMetrics = typeof powerMetrics.$inferSelect;
export type NewPowerMetrics = typeof powerMetrics.$inferInsert;
export type ScheduledOperation = typeof scheduledOperations.$inferSelect;
export type NewScheduledOperation = typeof scheduledOperations.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;