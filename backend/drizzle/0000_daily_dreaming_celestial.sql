CREATE TABLE IF NOT EXISTS "outlet_state_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"previous_state" text,
	"new_state" text,
	"change_type" text,
	"initiated_by" text,
	"timestamp" timestamp with time zone DEFAULT now(),
	"success" boolean DEFAULT false,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pdu_id" uuid NOT NULL,
	"outlet_number" integer NOT NULL,
	"name" text,
	"description" text,
	"display_order" integer,
	"desired_state" text,
	"actual_state" text,
	"last_state_change" timestamp with time zone,
	"is_critical" boolean DEFAULT false,
	"auto_recovery" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pdu_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pdu_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"description" text,
	"metadata" jsonb,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pdus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"ip_address" text NOT NULL,
	"model" text,
	"snmp_version" text DEFAULT 'v3',
	"snmp_user" text,
	"snmp_auth_protocol" text,
	"snmp_auth_passphrase" text,
	"snmp_priv_protocol" text,
	"snmp_priv_passphrase" text,
	"snmp_security_level" text,
	"is_active" boolean DEFAULT true,
	"last_seen" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "pdus_ip_address_unique" UNIQUE("ip_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "power_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pdu_id" uuid NOT NULL,
	"total_power_draw" numeric(10, 2),
	"total_power_watts" integer,
	"voltage" integer DEFAULT 230,
	"load_state" text,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"scheduled_time" timestamp with time zone NOT NULL,
	"executed" boolean DEFAULT false,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outlet_state_history_outlet_id" ON "outlet_state_history" ("outlet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outlet_state_history_timestamp" ON "outlet_state_history" ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_pdu_outlet" ON "outlets" ("pdu_id","outlet_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outlets_pdu_id" ON "outlets" ("pdu_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outlets_desired_state" ON "outlets" ("desired_state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outlets_actual_state" ON "outlets" ("actual_state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_outlets_display_order" ON "outlets" ("pdu_id","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pdu_events_pdu_id" ON "pdu_events" ("pdu_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pdu_events_timestamp" ON "pdu_events" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pdus_ip_address" ON "pdus" ("ip_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pdus_is_active" ON "pdus" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_power_metrics_pdu_id" ON "power_metrics" ("pdu_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_power_metrics_timestamp" ON "power_metrics" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scheduled_operations_outlet_id" ON "scheduled_operations" ("outlet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scheduled_operations_scheduled_time" ON "scheduled_operations" ("scheduled_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scheduled_operations_executed" ON "scheduled_operations" ("executed");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outlet_state_history" ADD CONSTRAINT "outlet_state_history_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outlets" ADD CONSTRAINT "outlets_pdu_id_pdus_id_fk" FOREIGN KEY ("pdu_id") REFERENCES "pdus"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pdu_events" ADD CONSTRAINT "pdu_events_pdu_id_pdus_id_fk" FOREIGN KEY ("pdu_id") REFERENCES "pdus"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "power_metrics" ADD CONSTRAINT "power_metrics_pdu_id_pdus_id_fk" FOREIGN KEY ("pdu_id") REFERENCES "pdus"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_operations" ADD CONSTRAINT "scheduled_operations_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
