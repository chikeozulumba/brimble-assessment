ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "log_path" text;
--> statement-breakpoint
DROP TABLE IF EXISTS "deployment_logs";
