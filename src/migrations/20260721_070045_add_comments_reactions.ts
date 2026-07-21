import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_comments_status" AS ENUM('published', 'hidden');
  CREATE TYPE "public"."enum_reactions_target_type" AS ENUM('publication', 'comment');
  CREATE TYPE "public"."enum_reactions_emoji" AS ENUM('like', 'love', 'fire', 'cry');
  CREATE TABLE "comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"publication_id" integer NOT NULL,
  	"author_id" integer NOT NULL,
  	"text" varchar NOT NULL,
  	"parent_id" integer,
  	"status" "enum_comments_status" DEFAULT 'published' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"target_type" "enum_reactions_target_type" NOT NULL,
  	"publication_id" integer,
  	"comment_id" integer,
  	"subscriber_id" integer NOT NULL,
  	"emoji" "enum_reactions_emoji" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "comments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reactions_id" integer;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_subscribers_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reactions" ADD CONSTRAINT "reactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reactions" ADD CONSTRAINT "reactions_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reactions" ADD CONSTRAINT "reactions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reactions" ADD CONSTRAINT "reactions_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "comments_tenant_idx" ON "comments" USING btree ("tenant_id");
  CREATE INDEX "comments_publication_idx" ON "comments" USING btree ("publication_id");
  CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id");
  CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_id");
  CREATE INDEX "comments_updated_at_idx" ON "comments" USING btree ("updated_at");
  CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");
  CREATE INDEX "reactions_tenant_idx" ON "reactions" USING btree ("tenant_id");
  CREATE INDEX "reactions_publication_idx" ON "reactions" USING btree ("publication_id");
  CREATE INDEX "reactions_comment_idx" ON "reactions" USING btree ("comment_id");
  CREATE INDEX "reactions_subscriber_idx" ON "reactions" USING btree ("subscriber_id");
  CREATE INDEX "reactions_updated_at_idx" ON "reactions" USING btree ("updated_at");
  CREATE INDEX "reactions_created_at_idx" ON "reactions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reactions_fk" FOREIGN KEY ("reactions_id") REFERENCES "public"."reactions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("comments_id");
  CREATE INDEX "payload_locked_documents_rels_reactions_id_idx" ON "payload_locked_documents_rels" USING btree ("reactions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reactions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "comments" CASCADE;
  DROP TABLE "reactions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_comments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reactions_fk";
  
  DROP INDEX "payload_locked_documents_rels_comments_id_idx";
  DROP INDEX "payload_locked_documents_rels_reactions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "comments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reactions_id";
  DROP TYPE "public"."enum_comments_status";
  DROP TYPE "public"."enum_reactions_target_type";
  DROP TYPE "public"."enum_reactions_emoji";`)
}
