import { test, expect, Page } from '@playwright/test'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import { seedPersonas, cleanupPersonas } from '../helpers/seedPersonas'
import { loginStudioAuthor } from '../helpers/loginPersonas'
import { stabilize, shot, DESKTOP } from '../helpers/visual'

/**
 * Визуальный QA — СТУДИЯ (автор, collection users с tenant+tenantRole).
 * Смоук + скриншоты ключевых экранов + CRUD-проверка создания категории.
 *
 * СЕЛЕКТОРЫ CRUD взяты из исходников (CategoriesManager/Composer). Если UI менялся —
 * поправить подписи кнопок/плейсхолдеры и перегенерить бейзлайны.
 */
const TEST_CATEGORY = 'E2E авто-категория'

test.describe('Студия (автор)', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedPersonas()
    const ctx = await browser.newContext({ viewport: DESKTOP })
    page = await ctx.newPage()
    await loginStudioAuthor(page)
  })

  test.afterAll(async () => {
    // подчистить созданную тестом категорию + персон
    const payload = await getPayload({ config })
    await payload
      .delete({ collection: 'categories', where: { title: { equals: TEST_CATEGORY } }, overrideAccess: true })
      .catch(() => {})
    await cleanupPersonas()
  })

  test('дашборд + навигация студии', async () => {
    const res = await page.goto('/studio')
    expect(res?.status()).toBeLessThan(400)
    await expect(page).not.toHaveURL(/\/studio\/login/)
    for (const href of ['/studio/posts', '/studio/videos', '/studio/categories']) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible()
    }
    await stabilize(page)
    await expect(page).toHaveScreenshot('studio-dashboard.png', shot(page))
  })

  const SCREENS = [
    ['posts', '/studio/posts'],
    ['videos', '/studio/videos'],
    ['categories', '/studio/categories'],
  ] as const
  for (const [name, url] of SCREENS) {
    test(`экран «${name}» открывается`, async () => {
      const res = await page.goto(url)
      expect(res?.status()).toBeLessThan(400)
      await stabilize(page)
      await expect(page).toHaveScreenshot(`studio-${name}.png`, shot(page))
    })
  }

  test('композер публикации: ключевые поля на месте', async () => {
    const res = await page.goto('/studio/posts/new')
    expect(res?.status()).toBeLessThan(400)
    await expect(page.getByPlaceholder('Заголовок публикации')).toBeVisible()
    await expect(page.getByText('Новость').first()).toBeVisible()
    await expect(page.getByText('Новинка').first()).toBeVisible()
    await expect(page.getByText('Уровень доступа').first()).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('studio-composer.png', shot(page))
  })

  test('CRUD: создание корневой категории', async () => {
    await page.goto('/studio/categories')
    await expect(page.getByRole('heading', { name: 'Категории' })).toBeVisible()
    await page.getByRole('button', { name: 'Новая категория' }).click()
    const nameInput = page.getByPlaceholder('Название категории')
    await expect(nameInput).toBeVisible()
    await nameInput.fill(TEST_CATEGORY)
    await page.getByRole('button', { name: 'Создать' }).click()
    // категория появилась в дереве
    await expect(page.getByText(TEST_CATEGORY).first()).toBeVisible({ timeout: 15_000 })
  })
})
