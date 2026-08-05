import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'

/**
 * Создание платформенного пользователя superadmin (кросс-тенантный god-аккаунт).
 *
 * Superadmin: platformRole='superadmin', tenant=null. Управляет ВСЕМИ тенантами
 * через штатную админку /admin. Доступ в кастомную /studio любого проекта —
 * через переключатель тенанта (отдельная фича studio switcher).
 *
 * Креды берутся из ENV (в репозитории пароль не хранится):
 *   SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME (опционально).
 *
 * ─── БЕЗОПАСНОСТЬ ────────────────────────────────────────────────────────
 *  • По умолчанию DRY-RUN: печатает план, ничего не пишет.
 *  • Реальное создание — только с CONFIRM=CREATE.
 *  • Идемпотентно: если пользователь с таким email уже есть — выходит, не трогая.
 *
 * ─── ЗАПУСК (прод-база, с Mac) ───────────────────────────────────────────
 *   # 1) План (безопасно):
 *   SUPERADMIN_EMAIL="dvasin@contentbox.site" SUPERADMIN_PASSWORD="***" \
 *   DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/create-superadmin.ts
 *
 *   # 2) Создать:
 *   CONFIRM=CREATE SUPERADMIN_EMAIL="dvasin@contentbox.site" SUPERADMIN_PASSWORD="***" \
 *   DATABASE_URL="$PROD_DB" PAYLOAD_SECRET="$SECRET" npx tsx src/scripts/create-superadmin.ts
 */

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.SUPERADMIN_PASSWORD || ''
  const name = (process.env.SUPERADMIN_NAME || '').trim() || 'Super Admin'
  const doWrite = process.env.CONFIRM === 'CREATE'

  if (!email || !password) {
    console.error('Нужны SUPERADMIN_EMAIL и SUPERADMIN_PASSWORD в окружении.')
    process.exit(1)
  }

  const payload = await getPayload({ config })

  // Идемпотентность: пользователь с таким email уже существует?
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1, depth: 0, overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    const u = existing.docs[0] as any
    console.error(
      `Пользователь с email "${email}" уже существует (#${u.id}, platformRole=${u.platformRole ?? 'нет'}). Ничего не делаю.`,
    )
    process.exit(1)
  }

  if (!doWrite) {
    console.log('DRY-RUN (ничего не создано). Будет создано:')
    console.log(`  • Пользователь: ${email}`)
    console.log(`  • Имя: ${name}`)
    console.log(`  • platformRole: superadmin (tenant=null — кросс-тенантный доступ в /admin)`)
    console.log('')
    console.log('Запусти с CONFIRM=CREATE, чтобы создать.')
    process.exit(0)
  }

  const user = (await payload.create({
    collection: 'users',
    data: { email, password, name, platformRole: 'superadmin' } as any,
    overrideAccess: true,
  })) as any

  console.log(`OK superadmin #${user.id} "${email}" создан. Вход: /admin (или /studio после включения switcher).`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
