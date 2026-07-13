import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "subscription_tiers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"weight" numeric DEFAULT 1 NOT NULL,
  	"price_rub" numeric NOT NULL,
  	"description" varchar,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subscribers_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "subscribers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"display_name" varchar,
  	"active_tier_id" integer,
  	"subscription_until" timestamp(3) with time zone,
  	"is_blocked" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "videos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"cover_id" integer,
  	"category_id" integer,
  	"min_tier_id" integer,
  	"is_preview" boolean DEFAULT false,
  	"video_ref" varchar,
  	"duration_sec" numeric,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscription_tiers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscribers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "videos_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "subscribers_id" integer;
  ALTER TABLE "subscription_tiers" ADD CONSTRAINT "subscription_tiers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscribers_sessions" ADD CONSTRAINT "subscribers_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_active_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("active_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "videos" ADD CONSTRAINT "videos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "videos" ADD CONSTRAINT "videos_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "videos" ADD CONSTRAINT "videos_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "videos" ADD CONSTRAINT "videos_min_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("min_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "subscription_tiers_tenant_idx" ON "subscription_tiers" USING btree ("tenant_id");
  CREATE INDEX "subscription_tiers_slug_idx" ON "subscription_tiers" USING btree ("slug");
  CREATE INDEX "subscription_tiers_updated_at_idx" ON "subscription_tiers" USING btree ("updated_at");
  CREATE INDEX "subscription_tiers_created_at_idx" ON "subscription_tiers" USING btree ("created_at");
  CREATE INDEX "subscribers_sessions_order_idx" ON "subscribers_sessions" USING btree ("_order");
  CREATE INDEX "subscribers_sessions_parent_id_idx" ON "subscribers_sessions" USING btree ("_parent_id");
  CREATE INDEX "subscribers_tenant_idx" ON "subscribers" USING btree ("tenant_id");
  CREATE INDEX "subscribers_active_tier_idx" ON "subscribers" USING btree ("active_tier_id");
  CREATE INDEX "subscribers_updated_at_idx" ON "subscribers" USING btree ("updated_at");
  CREATE INDEX "subscribers_created_at_idx" ON "subscribers" USING btree ("created_at");
  CREATE UNIQUE INDEX "subscribers_email_idx" ON "subscribers" USING btree ("email");
  CREATE INDEX "videos_tenant_idx" ON "videos" USING btree ("tenant_id");
  CREATE INDEX "videos_slug_idx" ON "videos" USING btree ("slug");
  CREATE INDEX "videos_cover_idx" ON "videos" USING btree ("cover_id");
  CREATE INDEX "videos_category_idx" ON "videos" USING btree ("category_id");
  CREATE INDEX "videos_min_tier_idx" ON "videos" USING btree ("min_tier_id");
  CREATE INDEX "videos_updated_at_idx" ON "videos" USING btree ("updated_at");
  CREATE INDEX "videos_created_at_idx" ON "videos" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscription_tiers_fk" FOREIGN KEY ("subscription_tiers_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscribers_fk" FOREIGN KEY ("subscribers_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_subscribers_fk" FOREIGN KEY ("subscribers_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_subscription_tiers_id_idx" ON "payload_locked_documents_rels" USING btree ("subscription_tiers_id");
  CREATE INDEX "payload_locked_documents_rels_subscribers_id_idx" ON "payload_locked_documents_rels" USING btree ("subscribers_id");
  CREATE INDEX "payload_locked_documents_rels_videos_id_idx" ON "payload_locked_documents_rels" USING btree ("videos_id");
  CREATE INDEX "payload_preferences_rels_subscribers_id_idx" ON "payload_preferences_rels" USING btree ("subscribers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "subscription_tiers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscribers_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscribers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "videos" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "subscription_tiers" CASCADE;
  DROP TABLE "subscribers_sessions" CASCADE;
  DROP TABLE "subscribers" CASCADE;
  DROP TABLE "videos" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_subscription_tiers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_subscribers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_videos_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_subscribers_fk";
  
  DROP INDEX "payload_locked_documents_rels_subscription_tiers_id_idx";
  DROP INDEX "payload_locked_documents_rels_subscribers_id_idx";
  DROP INDEX "payload_locked_documents_rels_videos_id_idx";
  DROP INDEX "payload_preferences_rels_subscribers_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "subscription_tiers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "subscribers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "videos_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "subscribers_id";`)
}
