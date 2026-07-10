import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories"
     ALTER COLUMN "description" SET DATA TYPE jsonb
     USING CASE
       WHEN "description" IS NULL OR "description" = '' THEN NULL
       ELSE to_jsonb("description")
     END;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories"
     ALTER COLUMN "description" SET DATA TYPE varchar
     USING "description"::text;`)
}
