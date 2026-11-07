CREATE TYPE "public"."challenge_category" AS ENUM('movement', 'nutrition', 'hydration', 'sleep', 'mindset');--> statement-breakpoint
CREATE TYPE "public"."challenge_frequency" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"title" text NOT NULL,
	"target" text NOT NULL,
	"why" text NOT NULL,
	"frequency" "challenge_frequency" NOT NULL,
	"category" "challenge_category" NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"encouragement" text NOT NULL,
	"focus_habits" jsonb NOT NULL,
	"sample_day" jsonb NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenges_profile_idx" ON "challenges" USING btree ("profile_id");