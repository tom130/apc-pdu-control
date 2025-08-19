-- PDU Control Database Schema
-- PostgreSQL schema for APC PDU management system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PDUs table
CREATE TABLE IF NOT EXISTS pdus (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45) NOT NULL,
    model VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    snmp_version VARCHAR(10) DEFAULT 'v3',
    snmp_user VARCHAR(100),
    snmp_auth_protocol VARCHAR(10),
    snmp_auth_passphrase TEXT,
    snmp_priv_protocol VARCHAR(10),
    snmp_priv_passphrase TEXT,
    snmp_security_level VARCHAR(20),
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Outlets table
CREATE TABLE IF NOT EXISTS outlets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pdu_id UUID NOT NULL REFERENCES pdus(id) ON DELETE CASCADE,
    outlet_number INTEGER NOT NULL,
    name VARCHAR(255),
    description TEXT,
    display_order INTEGER,
    desired_state VARCHAR(10),
    actual_state VARCHAR(10),
    is_critical BOOLEAN DEFAULT false,
    auto_recovery BOOLEAN DEFAULT true,
    last_state_change TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pdu_id, outlet_number)
);

-- Power metrics table
CREATE TABLE IF NOT EXISTS power_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pdu_id UUID NOT NULL REFERENCES pdus(id) ON DELETE CASCADE,
    total_power_draw DECIMAL(10, 2),
    load_state VARCHAR(20),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PDU Events table
CREATE TABLE IF NOT EXISTS pdu_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pdu_id UUID NOT NULL REFERENCES pdus(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    severity VARCHAR(20) DEFAULT 'info',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Outlet state history table
CREATE TABLE IF NOT EXISTS outlet_state_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    previous_state VARCHAR(10),
    new_state VARCHAR(10),
    change_type VARCHAR(20),
    initiated_by VARCHAR(50),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled operations table
CREATE TABLE IF NOT EXISTS scheduled_operations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    operation VARCHAR(10) NOT NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    executed BOOLEAN DEFAULT false,
    execution_time TIMESTAMP WITH TIME ZONE,
    result TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_outlets_pdu_id ON outlets(pdu_id);
CREATE INDEX IF NOT EXISTS idx_outlets_states ON outlets(desired_state, actual_state);
CREATE INDEX IF NOT EXISTS idx_outlets_display_order ON outlets(pdu_id, display_order);
CREATE INDEX IF NOT EXISTS idx_power_metrics_pdu_timestamp ON power_metrics(pdu_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pdu_events_pdu_timestamp ON pdu_events(pdu_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_outlet_history_outlet_timestamp ON outlet_state_history(outlet_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_ops_executed ON scheduled_operations(executed, scheduled_time);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pdus_updated_at BEFORE UPDATE ON pdus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outlets_updated_at BEFORE UPDATE ON outlets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();