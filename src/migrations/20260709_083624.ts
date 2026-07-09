import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_footer_column" AS ENUM('nav', 'support');
  ALTER TABLE "pages" ADD COLUMN "footer_column" "enum_pages_footer_column" DEFAULT 'nav';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages" DROP COLUMN "footer_column";
  DROP TYPE "public"."enum_pages_footer_column";`)
}
