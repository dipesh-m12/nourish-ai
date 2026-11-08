ALTER TYPE "public"."activity_kind" ADD VALUE 'cardio' BEFORE 'sleep';--> statement-breakpoint
ALTER TYPE "public"."activity_kind" ADD VALUE 'plyometrics' BEFORE 'sleep';--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "exercise_id" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "exercise_name" text;