CREATE TABLE "notifications_sent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"key" text NOT NULL,
	"local_date" date NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "push_token" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications_sent" ADD CONSTRAINT "notifications_sent_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_sent_once" ON "notifications_sent" USING btree ("profile_id","key","local_date");