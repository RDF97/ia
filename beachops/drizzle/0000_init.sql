CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"departure_id" uuid,
	"source" text NOT NULL,
	"channel" text,
	"external_ref" text,
	"external_ref_secondary" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"activity_date" date NOT NULL,
	"activity_time" time,
	"product_id" uuid,
	"location_id" uuid,
	"raw_product_name" text,
	"pax_adults" integer DEFAULT 0 NOT NULL,
	"pax_children" integer DEFAULT 0 NOT NULL,
	"customer_name" text,
	"customer_email" text,
	"customer_phone" text,
	"customer_country" text,
	"customer_language" text,
	"price_amount" numeric(10, 2),
	"price_currency" text DEFAULT 'EUR',
	"payment_kind" text DEFAULT 'platform' NOT NULL,
	"cash_amount" numeric(10, 2),
	"cash_confirmed" boolean DEFAULT false NOT NULL,
	"pickup_hotel" text,
	"notes" text,
	"source_email_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cash_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"date" date NOT NULL,
	"booking_id" uuid,
	"concept" text NOT NULL,
	"amount" numeric(10, 2),
	"kind" text DEFAULT 'booking_cash' NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"time_slot_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"product_id" uuid,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"capacity_override" integer,
	"is_double" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" text DEFAULT 'gmail' NOT NULL,
	"email_address" text NOT NULL,
	"refresh_token_enc" text,
	"last_history_id" text,
	"sync_status" text DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mapping_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"source" text,
	"match_field" text DEFAULT 'raw_product_name' NOT NULL,
	"match_type" text DEFAULT 'contains' NOT NULL,
	"match_value" text NOT NULL,
	"time_match" time,
	"target_product_id" uuid NOT NULL,
	"target_location_id" uuid NOT NULL,
	"target_time_slot_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"locale" text DEFAULT 'es' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'tour' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email_account_id" uuid,
	"gmail_message_id" text NOT NULL,
	"gmail_thread_id" text,
	"from_address" text,
	"subject" text,
	"received_at" timestamp with time zone,
	"body_html" text,
	"body_text" text,
	"detected_source" text,
	"detected_kind" text,
	"parse_status" text DEFAULT 'pending' NOT NULL,
	"parse_error" text,
	"parsed_payload" jsonb,
	"booking_id" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"product_id" uuid,
	"start_time" time NOT NULL,
	"default_capacity" integer DEFAULT 12 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_email_id_raw_emails_id_fk" FOREIGN KEY ("source_email_id") REFERENCES "public"."raw_emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departures" ADD CONSTRAINT "departures_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departures" ADD CONSTRAINT "departures_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departures" ADD CONSTRAINT "departures_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departures" ADD CONSTRAINT "departures_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_rules" ADD CONSTRAINT "mapping_rules_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_rules" ADD CONSTRAINT "mapping_rules_target_product_id_products_id_fk" FOREIGN KEY ("target_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_rules" ADD CONSTRAINT "mapping_rules_target_location_id_locations_id_fk" FOREIGN KEY ("target_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_rules" ADD CONSTRAINT "mapping_rules_target_time_slot_id_time_slots_id_fk" FOREIGN KEY ("target_time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_emails" ADD CONSTRAINT "raw_emails_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_emails" ADD CONSTRAINT "raw_emails_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_org_source_ref" ON "bookings" USING btree ("org_id","source","external_ref");--> statement-breakpoint
CREATE INDEX "bookings_org_date" ON "bookings" USING btree ("org_id","activity_date");--> statement-breakpoint
CREATE INDEX "cash_entries_org_date" ON "cash_entries" USING btree ("org_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "departures_org_date_slot" ON "departures" USING btree ("org_id","date","time_slot_id");--> statement-breakpoint
CREATE INDEX "departures_org_date" ON "departures" USING btree ("org_id","date");--> statement-breakpoint
CREATE INDEX "mapping_rules_org_priority" ON "mapping_rules" USING btree ("org_id","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_org_user" ON "memberships" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_emails_org_gmail_id" ON "raw_emails" USING btree ("org_id","gmail_message_id");--> statement-breakpoint
CREATE INDEX "raw_emails_org_status" ON "raw_emails" USING btree ("org_id","parse_status");