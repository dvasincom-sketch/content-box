import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_subscription_tiers_perks_type" AS ENUM('included', 'star', 'warning', 'info');
  CREATE TABLE "subscription_tiers_perks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_subscription_tiers_perks_type" DEFAULT 'included' NOT NULL,
  	"text" varchar NOT NULL
  );
  
  ALTER TABLE "subscription_tiers_perks" ADD CONSTRAINT "subscription_tiers_perks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."subscription_tiers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "subscription_tiers_perks_order_idx" ON "subscription_tiers_perks" USING btree ("_order");
  CREATE INDEX "subscription_tiers_perks_parent_id_idx" ON "subscription_tiers_perks" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "subscription_tiers_perks" CASCADE;
  DROP TYPE "public"."enum_subscription_tiers_perks_type";`)
}
