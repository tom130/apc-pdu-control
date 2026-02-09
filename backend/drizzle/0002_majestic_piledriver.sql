CREATE TABLE IF NOT EXISTS "cron_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cron_expression" text NOT NULL,
	"operation" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_executed_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cron_schedules_outlet_id" ON "cron_schedules" ("outlet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cron_schedules_is_active" ON "cron_schedules" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cron_schedules_next_run_at" ON "cron_schedules" ("next_run_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cron_schedules" ADD CONSTRAINT "cron_schedules_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
