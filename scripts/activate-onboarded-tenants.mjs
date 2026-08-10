// Активировать тенантов, созданных ДО автоактивации поддомена: где задан
// subdomain, но тенант не active / не verified. *.contentbox.site — наш апекс,
// отдельная DNS-TXT верификация не нужна.
//
// Запуск на Mac: node scripts/activate-onboarded-tenants.mjs
import 'dotenv/config'
import pg from 'pg'

const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.DATABASE_URI })
await c.connect()
try {
  const r = await c.query(
    `UPDATE tenants
        SET domain_verified = true, status = 'active', updated_at = now()
      WHERE subdomain IS NOT NULL AND subdomain <> ''
        AND (status <> 'active' OR domain_verified IS DISTINCT FROM true)
      RETURNING id, name, subdomain, domain, status`,
  )
  console.log(`Активировано тенантов: ${r.rowCount}`)
  for (const row of r.rows) console.log(` #${row.id} ${row.subdomain} (${row.domain}) -> ${row.status}`)
} finally {
  await c.end()
}
