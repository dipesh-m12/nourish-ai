-- Existing plans predate the metrics snapshot; plans are regenerable, so clear them (and their suggestions).
DELETE FROM "challenges";--> statement-breakpoint
DELETE FROM "plans";--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "metrics" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "model" text;