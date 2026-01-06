CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_used" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_key_hash" ON "api_keys" ("key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_is_active" ON "api_keys" ("is_active");