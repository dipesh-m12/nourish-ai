CREATE TABLE "billing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"razorpay_plan_id" text NOT NULL,
	"name" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"period" text NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_plans_key_unique" UNIQUE("key"),
	CONSTRAINT "billing_plans_razorpay_plan_id_unique" UNIQUE("razorpay_plan_id")
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"profile_id" uuid,
	"subscription_id" uuid,
	"razorpay_payment_id" text,
	"amount_paise" integer,
	"payload" jsonb NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "subscription_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"razorpay_subscription_id" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"start_at" timestamp with time zone,
	"next_bill_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"paid_count" integer DEFAULT 0 NOT NULL,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_razorpay_subscription_id_unique" UNIQUE("razorpay_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_events_profile_idx" ON "subscription_events" USING btree ("profile_id","received_at");--> statement-breakpoint
CREATE INDEX "subscriptions_profile_idx" ON "subscriptions" USING btree ("profile_id");