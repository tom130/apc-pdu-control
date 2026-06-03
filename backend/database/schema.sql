-- PDU Control Database Schema
-- Fresh-install PostgreSQL schema aligned with backend/src/db/schema.ts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS pdus (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    ip_address TEXT NOT NULL UNIQUE,
    model TEXT,
    snmp_version TEXT DEFAULT 'v3',
    snmp_user TEXT,
    snmp_auth_protocol TEXT,
    snmp_auth_passphrase TEXT,
    snmp_priv_protocol TEXT,
    snmp_priv_passphrase TEXT,
    snmp_security_level TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outlets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pdu_id UUID NOT NULL REFERENCES pdus(id) ON DELETE CASCADE,
    outlet_number INTEGER NOT NULL,
    name TEXT,
    description TEXT,
    display_order INTEGER,
    desired_state TEXT,
    actual_state TEXT,
    last_state_change TIMESTAMP WITH TIME ZONE,
    is_critical BOOLEAN DEFAULT false,
    auto_recovery BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outlet_state_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    previous_state TEXT,
    new_state TEXT,
    change_type TEXT,
    initiated_by TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    success BOOLEAN DEFAULT false,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS pdu_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pdu_id UUID NOT NULL REFERENCES pdus(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS power_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pdu_id UUID NOT NULL REFERENCES pdus(id) ON DELETE CASCADE,
    total_power_draw DECIMAL(10, 2),
    total_power_watts INTEGER,
    voltage INTEGER DEFAULT 230,
    load_state TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_operations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    executed BOOLEAN DEFAULT false,
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cron_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    operation TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_pdu_outlet ON outlets(pdu_id, outlet_number);

CREATE INDEX IF NOT EXISTS idx_pdus_ip_address ON pdus(ip_address);
CREATE INDEX IF NOT EXISTS idx_pdus_is_active ON pdus(is_active);

CREATE INDEX IF NOT EXISTS idx_outlets_pdu_id ON outlets(pdu_id);
CREATE INDEX IF NOT EXISTS idx_outlets_desired_state ON outlets(desired_state);
CREATE INDEX IF NOT EXISTS idx_outlets_actual_state ON outlets(actual_state);
CREATE INDEX IF NOT EXISTS idx_outlets_display_order ON outlets(pdu_id, display_order);

CREATE INDEX IF NOT EXISTS idx_outlet_state_history_outlet_id ON outlet_state_history(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_state_history_timestamp ON outlet_state_history(timestamp);

CREATE INDEX IF NOT EXISTS idx_pdu_events_pdu_id ON pdu_events(pdu_id);
CREATE INDEX IF NOT EXISTS idx_pdu_events_timestamp ON pdu_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_power_metrics_pdu_id ON power_metrics(pdu_id);
CREATE INDEX IF NOT EXISTS idx_power_metrics_timestamp ON power_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_scheduled_operations_outlet_id ON scheduled_operations(outlet_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_operations_scheduled_time ON scheduled_operations(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_operations_executed ON scheduled_operations(executed);

CREATE INDEX IF NOT EXISTS idx_cron_schedules_outlet_id ON cron_schedules(outlet_id);
CREATE INDEX IF NOT EXISTS idx_cron_schedules_is_active ON cron_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_cron_schedules_next_run_at ON cron_schedules(next_run_at);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
