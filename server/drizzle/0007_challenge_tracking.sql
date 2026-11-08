CREATE TABLE "challenge_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"amount" real NOT NULL,
	"proof_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "tracking" jsonb;--> statement-breakpoint
ALTER TABLE "challenge_logs" ADD CONSTRAINT "challenge_logs_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_logs" ADD CONSTRAINT "challenge_logs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_logs_challenge_date_idx" ON "challenge_logs" USING btree ("challenge_id","local_date");