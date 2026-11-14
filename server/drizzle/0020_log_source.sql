ALTER TABLE "activities" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "challenge_logs" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;