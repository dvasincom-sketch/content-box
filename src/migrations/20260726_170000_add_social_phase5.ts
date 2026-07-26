import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Фаза 5 «Соцсеть»: bookmarks (сохранёнки), follows (подписки на аккаунты),
 * views (история просмотров) + subscribers.history_enabled. Все tenant-scoped.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_bookmarks_target_type" AS ENUM('publication', 'video');
  CREATE TYPE "public"."enum_views_target_type" AS ENUM('publication', 'video');

  CREATE TABLE "bookmarks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"subscriber_id" integer NOT NULL,
  	"target_type" "enum_bookmarks_target_type" NOT NULL,
  	"publication_id" integer,
  	"video_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "follows" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"follower_id" integer NOT NULL,
  	"following_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "views" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"subscriber_id" integer NOT NULL,
  	"target_type" "enum_views_target_type" NOT NULL,
  	"publication_id" integer,
  	"video_id" integer,
  	"viewed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "subscribers" ADD COLUMN "history_enabled" boolean DEFAULT true;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bookmarks_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "follows_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "views_id" integer;

  ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follows" ADD CONSTRAINT "follows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_subscribers_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_subscribers_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "views" ADD CONSTRAINT "views_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "views" ADD CONSTRAINT "views_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "views" ADD CONSTRAINT "views_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "views" ADD CONSTRAINT "views_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;

  CREATE INDEX "bookmarks_tenant_idx" ON "bookmarks" USING btree ("tenant_id");
  CREATE INDEX "bookmarks_subscriber_idx" ON "bookmarks" USING btree ("subscriber_id");
  CREATE INDEX "bookmarks_publication_idx" ON "bookmarks" USING btree ("publication_id");
  CREATE INDEX "bookmarks_video_idx" ON "bookmarks" USING btree ("video_id");
  CREATE INDEX "bookmarks_updated_at_idx" ON "bookmarks" USING btree ("updated_at");
  CREATE INDEX "bookmarks_created_at_idx" ON "bookmarks" USING btree ("created_at");
  CREATE INDEX "follows_tenant_idx" ON "follows" USING btree ("tenant_id");
  CREATE INDEX "follows_follower_idx" ON "follows" USING btree ("follower_id");
  CREATE INDEX "follows_following_idx" ON "follows" USING btree ("following_id");
  CREATE INDEX "follows_updated_at_idx" ON "follows" USING btree ("updated_at");
  CREATE INDEX "follows_created_at_idx" ON "follows" USING btree ("created_at");
  CREATE UNIQUE INDEX "follows_pair_idx" ON "follows" USING btree ("follower_id","following_id");
  CREATE INDEX "views_tenant_idx" ON "views" USING btree ("tenant_id");
  CREATE INDEX "views_subscriber_idx" ON "views" USING btree ("subscriber_id");
  CREATE INDEX "views_publication_idx" ON "views" USING btree ("publication_id");
  CREATE INDEX "views_video_idx" ON "views" USING btree ("video_id");
  CREATE INDEX "views_viewed_at_idx" ON "views" USING btree ("viewed_at");
  CREATE INDEX "views_updated_at_idx" ON "views" USING btree ("updated_at");
  CREATE INDEX "views_created_at_idx" ON "views" USING btree ("created_at");

  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookmarks_fk" FOREIGN KEY ("bookmarks_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_follows_fk" FOREIGN KEY ("follows_id") REFERENCES "public"."follows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_views_fk" FOREIGN KEY ("views_id") REFERENCES "public"."views"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_bookmarks_id_idx" ON "payload_locked_documents_rels" USING btree ("bookmarks_id");
  CREATE INDEX "payload_locked_documents_rels_follows_id_idx" ON "payload_locked_documents_rels" USING btree ("follows_id");
  CREATE INDEX "payload_locked_documents_rels_views_id_idx" ON "payload_locked_documents_rels" USING btree ("views_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bookmarks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "follows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "views" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "bookmarks" CASCADE;
  DROP TABLE "follows" CASCADE;
  DROP TABLE "views" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_bookmarks_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_follows_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_views_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_bookmarks_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_follows_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_views_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "bookmarks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "follows_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "views_id";
  ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "history_enabled";
  DROP TYPE "public"."enum_bookmarks_target_type";
  DROP TYPE "public"."enum_views_target_type";`)
}
