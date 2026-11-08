CREATE TABLE "app_version_rules" (
	"platform" text PRIMARY KEY NOT NULL,
	"blocked_through" text,
	"message" text,
	"update_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
