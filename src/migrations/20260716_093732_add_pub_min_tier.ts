import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "publications" ADD COLUMN "min_tier_id" integer;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_min_tier_id_subscription_tiers_id_fk" FOREIGN KEY ("min_tier_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "publications_min_tier_idx" ON "publications" USING btree ("min_tier_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "publications" DROP CONSTRAINT "publications_min_tier_id_subscription_tiers_id_fk";
  
  DROP INDEX "publications_min_tier_idx";
  ALTER TABLE "publications" DROP COLUMN "min_tier_id";`)
}
