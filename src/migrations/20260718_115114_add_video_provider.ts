import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_videos_provider" AS ENUM('stream', 'kinescope');
  ALTER TABLE "videos" ADD COLUMN "provider" "enum_videos_provider" DEFAULT 'stream' NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "videos" DROP COLUMN "provider";
  DROP TYPE "public"."enum_videos_provider";`)
}
