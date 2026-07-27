import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Привязка собственного домена btsrussia.ru к тенанту BTS (data-fix, не схема).
 *
 * Резолвинг (src/proxy.ts): собственный домен ищется по полю tenants.domain
 * (требуются status='active' и domain_verified=true), а бесплатный поддомен
 * bts.contentbox.site — по полю tenants.subdomain (независимо от domain).
 * Поэтому достаточно записать домен в поле domain — поддомен продолжит работать,
 * а proxy.ts затем 301-редиректит его на канонический btsrussia.ru.
 *
 * Причина миграции: админка не дала отредактировать поле вручную. Ключ строки —
 * subdomain='bts' (надёжный идентификатор тенанта BTS). Идемпотентно.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "tenants"
    SET "domain" = 'btsrussia.ru',
        "domain_verified" = true,
        "status" = 'active'
    WHERE "subdomain" = 'bts';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "tenants"
    SET "domain" = 'bts.contentbox.site'
    WHERE "subdomain" = 'bts';
  `)
}
