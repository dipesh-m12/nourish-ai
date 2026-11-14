ALTER TABLE "challenges" ADD COLUMN "ends_on" date;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "source" text DEFAULT 'plan' NOT NULL;