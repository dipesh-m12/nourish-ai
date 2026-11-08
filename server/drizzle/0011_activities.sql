CREATE TYPE "public"."activity_kind" AS ENUM('walk', 'brisk_walk', 'run', 'cycle', 'yoga', 'stretch', 'strength', 'dance', 'sport', 'swim', 'chores', 'sleep');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"kind" "activity_kind" NOT NULL,
	"minutes" real NOT NULL,
	"calories" integer NOT NULL,
	"calories_from_user" boolean DEFAULT false NOT NULL,
	"proof_note" text,
	"challenge_log_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_challenge_log_id_challenge_logs_id_fk" FOREIGN KEY ("challenge_log_id") REFERENCES "public"."challenge_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_profile_date_idx" ON "activities" USING btree ("profile_id","local_date");