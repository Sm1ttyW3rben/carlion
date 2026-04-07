CREATE TYPE "public"."tenant_plan" AS ENUM('free', 'trial', 'starter', 'professional');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'trial', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'manager', 'salesperson', 'mechanic', 'receptionist', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."ai_event_status" AS ENUM('success', 'failed', 'pending', 'rolled_back');--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('user', 'ai', 'system');--> statement-breakpoint
CREATE TYPE "public"."ai_action_status" AS ENUM('proposed', 'confirmed', 'executed', 'rolled_back', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."file_processing_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."border_radius_style" AS ENUM('none', 'sm', 'md', 'lg', 'full');--> statement-breakpoint
CREATE TYPE "public"."branding_completeness" AS ENUM('draft', 'branding_complete', 'publish_ready');--> statement-breakpoint
CREATE TYPE "public"."branding_formality" AS ENUM('du', 'sie');--> statement-breakpoint
CREATE TYPE "public"."branding_tone" AS ENUM('professional', 'friendly', 'premium', 'casual');--> statement-breakpoint
CREATE TYPE "public"."button_style" AS ENUM('solid', 'outline', 'ghost');--> statement-breakpoint
CREATE TYPE "public"."crawl_status" AS ENUM('pending', 'crawling', 'analyzing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."dealership_type" AS ENUM('einzelhaendler', 'autohaus', 'mehrmarkenhaendler', 'premiumhaendler');--> statement-breakpoint
CREATE TYPE "public"."description_style" AS ENUM('factual', 'emotional', 'balanced');--> statement-breakpoint
CREATE TYPE "public"."font_body" AS ENUM('Inter', 'Open Sans', 'Lato', 'Nunito Sans');--> statement-breakpoint
CREATE TYPE "public"."font_heading" AS ENUM('Inter', 'Nunito', 'Playfair Display', 'Poppins');--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"org_id" uuid,
	"plan" "tenant_plan" DEFAULT 'trial' NOT NULL,
	"status" "tenant_status" DEFAULT 'trial' NOT NULL,
	"branding" jsonb,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trial_ends_at" timestamp with time zone,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'salesperson' NOT NULL,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_event_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"summary" text,
	"status" "ai_event_status" DEFAULT 'pending' NOT NULL,
	"rollback_data" jsonb,
	"token_usage" integer,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_action_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assistant_message_id" uuid,
	"action_type" text NOT NULL,
	"target_module" text NOT NULL,
	"proposed_changes" jsonb,
	"confirm_token" text,
	"confirm_expires" timestamp with time zone,
	"status" "ai_action_status" DEFAULT 'proposed' NOT NULL,
	"rollback_data" jsonb,
	"external_effects" jsonb,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_action_commands_confirm_token_unique" UNIQUE("confirm_token")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service" text NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"kind" text NOT NULL,
	"position" integer,
	"is_public" boolean DEFAULT false NOT NULL,
	"alt_text" text,
	"processing_status" "file_processing_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dna_crawl_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"status" "crawl_status" DEFAULT 'pending' NOT NULL,
	"raw_html" text,
	"extracted_data" jsonb,
	"ai_analysis" jsonb,
	"error_message" text,
	"duration_ms" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"logo_file_id" uuid,
	"favicon_file_id" uuid,
	"primary_color" text DEFAULT '#2563EB' NOT NULL,
	"secondary_color" text DEFAULT '#1E40AF' NOT NULL,
	"accent_color" text,
	"background_color" text DEFAULT '#FFFFFF' NOT NULL,
	"text_color" text DEFAULT '#1A1A1A' NOT NULL,
	"color_palette" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"font_heading" "font_heading" DEFAULT 'Inter' NOT NULL,
	"font_body" "font_body" DEFAULT 'Inter' NOT NULL,
	"border_radius" "border_radius_style" DEFAULT 'md' NOT NULL,
	"button_style" "button_style" DEFAULT 'solid' NOT NULL,
	"tone" "branding_tone" DEFAULT 'professional' NOT NULL,
	"formality" "branding_formality" DEFAULT 'sie' NOT NULL,
	"dealership_type" "dealership_type" DEFAULT 'einzelhaendler' NOT NULL,
	"tagline" text,
	"welcome_message" text,
	"email_signature" text,
	"description_style" "description_style" DEFAULT 'balanced' NOT NULL,
	"address" jsonb,
	"phone" text,
	"email" text,
	"opening_hours" jsonb,
	"website_url" text,
	"google_maps_url" text,
	"imprint_data" jsonb,
	"completeness" "branding_completeness" DEFAULT 'draft' NOT NULL,
	"onboarding_source" text,
	"generation_log" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_branding_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_event_log" ADD CONSTRAINT "ai_event_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_event_log" ADD CONSTRAINT "ai_event_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_commands" ADD CONSTRAINT "ai_action_commands_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_commands" ADD CONSTRAINT "ai_action_commands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dna_crawl_results" ADD CONSTRAINT "dna_crawl_results_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_logo_file_id_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_favicon_file_id_files_id_fk" FOREIGN KEY ("favicon_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;