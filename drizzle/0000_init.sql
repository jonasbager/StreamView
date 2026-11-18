CREATE TABLE "families" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"invite_code" text NOT NULL,
	"board" jsonb,
	"recommendation" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "families_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"household_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"answers" jsonb,
	"onboarded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text,
	"provider_id" text NOT NULL,
	"kind" text NOT NULL,
	"product_id" text,
	"proposed" jsonb,
	"diff" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"trigger" text NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"price" real NOT NULL,
	"intro_price" real,
	"intro_months" integer,
	"setup_fee" real DEFAULT 0 NOT NULL,
	"binding_months" integer DEFAULT 0 NOT NULL,
	"includes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"offer_text" text,
	"offer_ends_at" timestamp,
	"source_url" text,
	"verified_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"color" text NOT NULL,
	"url" text NOT NULL,
	"price_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"offers" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"color" text NOT NULL,
	"capacity_type" text NOT NULL,
	"sharing" jsonb NOT NULL,
	"url" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_run_id_price_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."price_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;