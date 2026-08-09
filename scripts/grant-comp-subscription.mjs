// Выдать подписчику «комп»-доступ по максимальному тарифу (для тестов/сотрудников).
// Ставит активный тариф = самый весомый уровень его тенанта, продлевает подписку
// и снимает блокировку. Так checkVideoAccess пропускает его к любому контенту.
//
// Запуск (из корня репозитория, где есть .env с DATABASE_URL):
//   node scripts/grant-comp-subscription.mjs <email> [лет=10]
import 'dotenv/config'
import pg from 'pg'

const email = process.argv[2]
const years = Number(process.argv[3] || '10')
if (!email) {
  console.error('Использование: node scripts/grant-comp-subscription.mjs <email> [лет]')
  process.exit(1)
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.DATABASE_URI })
await c.connect()
try {
  const sub = await c.query('SELECT id, tenant_id, email FROM subscribers WHERE lower(email)=lower($1) LIMIT 1', [email])
  if (!sub.rows.length) { console.error('Подписчик не найден:', email); process.exit(2) }
  const { id, tenant_id } = sub.rows[0]

  const tier = await c.query(
    'SELECT id, name, weight FROM subscription_tiers WHERE tenant_id=$1 ORDER BY weight DESC LIMIT 1',
    [tenant_id],
  )
  if (!tier.rows.length) { console.error('У тенанта нет тарифов — сначала создайте уровень подписки'); process.exit(3) }
  const t = tier.rows[0]

  await c.query(
    `UPDATE subscribers
        SET active_tier_id = $1,
            subscription_until = now() + make_interval(years => $2::int),
            is_blocked = false,
            updated_at = now()
      WHERE id = $3`,
    [t.id, years, id],
  )
  console.log(`OK: ${email} → тариф «${t.name}» (макс, weight=${t.weight}); подписка +${years} лет; разблокирован.`)
} finally {
  await c.end()
}
