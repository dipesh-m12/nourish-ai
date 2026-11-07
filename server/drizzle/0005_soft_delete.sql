DROP INDEX "profiles_name_lower_unique";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_name_lower_unique" ON "profiles" USING btree (lower("name")) WHERE "profiles"."deleted_at" is null;