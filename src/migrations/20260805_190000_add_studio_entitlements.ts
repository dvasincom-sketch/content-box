import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Права студии (задел под тарифы). Колонки на tenants:
 *  - cap_books / cap_media: none | trial | active (доступ к разделам);
 *  - cap_books_until / cap_media_until: конец триала;
 *  - cap_custom_domain: свой домен (платно);
 *  - studio_frozen: студия заморожена (180 дней без платных подписок и т.п.).
 *
 * ВАЖНО: дефолты дают ПОЛНЫЙ доступ (active/true/false-frozen), чтобы уже
 * существующие тенанты не потеряли доступ при накатке. Ограничения включаются
 * точечно (админка/биллинг).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenants_cap_books" AS ENUM('none', 'trial', 'active');
  CREATE TYPE "public"."enum_tenants_cap_media" AS ENUM('none', 'trial', 'active');
  ALTER TABLE "tenants" ADD COLUMN "cap_books" "enum_tenants_cap_books" DEFAULT 'active';
  ALTER TABLE "tenants" ADD COLUMN "cap_media" "enum_tenants_cap_media" DEFAULT 'active';
  ALTER TABLE "tenants" ADD COLUMN "cap_books_until" timestamp(3) with time zone;
  ALTER TABLE "tenants" ADD COLUMN "cap_media_until" timestamp(3) with time zone;
  ALTER TABLE "tenants" ADD COLUMN "cap_custom_domain" boolean DEFAULT true;
  ALTER TABLE "tenants" ADD COLUMN "studio_frozen" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "cap_books";
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "cap_media";
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "cap_books_until";
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "cap_media_until";
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "cap_custom_domain";
  ALTER TABLE "tenants" DROP COLUMN IF EXISTS "studio_frozen";
  DROP TYPE "public"."enum_tenants_cap_books";
  DROP TYPE "public"."enum_tenants_cap_media";`)
}
