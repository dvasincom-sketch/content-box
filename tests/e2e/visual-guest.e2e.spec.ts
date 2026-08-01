import { test, expect } from '@playwright/test'
import { openStable, setTheme, stabilize, shot, DESKTOP, MOBILE } from '../helpers/visual'

/**
 * Визуальный QA — ГОСТЕВЫЕ истории (без логина).
 *
 * По каждой странице: функц. ассерты (страница жива, тенант резолвится, есть
 * шапка) + скриншот-регрессия в СВЕТЛОЙ и ТЁМНОЙ теме. Точные тексты не фиксируем
 * (контент у тенанта меняется) — как в frontend.e2e.spec.ts.
 *
 * Бейзлайны генерятся первым прогоном:
 *   npm run test:e2e -- --update-snapshots
 * Против прода:  E2E_BASE_URL=https://btsrussia.ru npm run test:e2e
 */
const THEMES = ['light', 'dark'] as const

test.use({ viewport: DESKTOP })

for (const theme of THEMES) {
  test.describe(`Гость · ${theme}`, () => {
    test('главная', async ({ page }) => {
      const status = await openStable(page, '/', theme)
      expect(status).toBeLessThan(400)
      await expect(page).not.toHaveURL(/domain-not-found/)
      await expect(page).toHaveTitle(/.+/)
      await expect(page.locator('header').first()).toBeVisible()
      await expect(page).toHaveScreenshot(`home-${theme}.png`, shot(page))
    })

    test('категория «Смотреть» + крошки', async ({ page }) => {
      const status = await openStable(page, '/category/watch', theme)
      expect(status).toBeLessThan(400)
      await expect(page.locator('header').first()).toBeVisible()
      await expect(page.getByText('Главная').first()).toBeVisible() // хлебные крошки
      await expect(page).toHaveScreenshot(`category-watch-${theme}.png`, shot(page))
    })

    test('страница публикации', async ({ page }) => {
      // slug 'rm' может отличаться у другого тенанта — тогда правится под контент.
      const status = await openStable(page, '/publication/rm', theme)
      expect(status).toBeLessThan(500)
      await expect(page.locator('header').first()).toBeVisible()
      await expect(page).toHaveScreenshot(`publication-${theme}.png`, shot(page))
    })

    test('поиск (noindex)', async ({ page }) => {
      const status = await openStable(page, '/search', theme)
      expect(status).toBeLessThan(400)
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
      await expect(page).toHaveScreenshot(`search-${theme}.png`, shot(page))
    })

    test('подписка (тарифы)', async ({ page }) => {
      const status = await openStable(page, '/subscribe', theme)
      expect(status).toBeLessThan(400)
      await expect(page.locator('header').first()).toBeVisible()
      await expect(page).toHaveScreenshot(`subscribe-${theme}.png`, shot(page))
    })

    test('404 несуществующей публикации', async ({ page }) => {
      const res = await page.goto('/publication/zavedomo-nesushchestvuyushchiy-slug-xyz')
      expect(res?.status()).toBe(404)
      await setTheme(page, theme)
      await stabilize(page)
      await expect(page).toHaveScreenshot(`not-found-${theme}.png`, shot(page))
    })
  })
}

// Мобильная версия — главная в обеих темах (адаптив шапки/героя).
for (const theme of THEMES) {
  test(`Гость · моб · главная · ${theme}`, async ({ page }) => {
    await page.setViewportSize(MOBILE)
    const status = await openStable(page, '/', theme)
    expect(status).toBeLessThan(400)
    await expect(page).toHaveScreenshot(`home-mobile-${theme}.png`, shot(page))
  })
}
