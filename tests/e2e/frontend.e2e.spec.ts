import { test, expect } from '@playwright/test'

/**
 * E2E публичного сайта.
 *
 * Тест был сломан: он проверял заголовок `Payload Blank Template` и текст
 * «Welcome to your new project.» — это осталось от стартового шаблона Payload
 * и в проекте не встречается уже давно. Прогонов не было (в CI e2e не входят,
 * им нужны живой Postgres и поднятый dev-сервер), поэтому никто не замечал.
 *
 * Проверяем то, что верно для ЛЮБОГО состояния базы, чтобы тест не начинал
 * врать при смене контента: страница отвечает, это наш сайт, есть заголовок и
 * рабочая навигация. Точные тексты не фиксируем — они у каждого тенанта свои.
 *
 * Требует: `npm run dev` и хотя бы одного активного тенанта (на localhost
 * proxy.ts берёт первого активного, см. resolveDevTenant).
 */
test.describe('Публичный сайт', () => {
  test('главная открывается и отдаёт разметку тенанта', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)

    // Тенант резолвится → это не заглушка «домен не найден».
    await expect(page).not.toHaveURL(/domain-not-found/)

    // У страницы есть непустой заголовок (SEO-дефолты тенанта или его имя).
    await expect(page).toHaveTitle(/.+/)

    await expect(page.locator('header').first()).toBeVisible()
  })

  test('поиск отвечает и не индексируется', async ({ page }) => {
    const res = await page.goto('/search')
    expect(res?.status()).toBe(200)

    // robots: noindex стоит осознанно — страницы результатов в индекс не нужны.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    )
  })

  test('несуществующая публикация отдаёт 404, а не пустую страницу', async ({ page }) => {
    const res = await page.goto('/publication/zavedomo-nesushchestvuyushchiy-slug')
    expect(res?.status()).toBe(404)
  })
})
