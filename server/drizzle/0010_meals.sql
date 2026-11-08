CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"title" text NOT NULL,
	"items" jsonb NOT NULL,
	"calories" integer NOT NULL,
	"protein_g" integer NOT NULL,
	"carbs_g" integer NOT NULL,
	"fat_g" integer NOT NULL,
	"comment" text,
	"photo_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_logs" ADD COLUMN "meal_id" uuid;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meals_profile_date_idx" ON "meals" USING btree ("profile_id","local_date");--> statement-breakpoint
ALTER TABLE "challenge_logs" ADD CONSTRAINT "challenge_logs_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;