import { test, expect, Page } from '@playwright/test'
import { seedPersonas, cleanupPersonas } from '../helpers/seedPersonas'
import { loginSubscriber } from '../helpers/loginPersonas'
import { setTheme, stabilize, shot, DESKTOP } from '../helpers/visual'

/**
 * Визуальный QA — ЗАРЕГИСТРИРОВАННЫЙ подписчик (collection subscribers).
 * Логинимся один раз (beforeAll), дальше переиспользуем страницу — как в admin.e2e.
 */
test.describe('Зарегистрированный подписчик', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedPersonas()
    const ctx = await browser.newContext({ viewport: DESKTOP })
    page = await ctx.newPage()
    await loginSubscriber(page)
  })

  test.afterAll(async () => {
    await cleanupPersonas()
  })

  test('личный кабинет /account открыт (не редирект на /login)', async () => {
    const res = await page.goto('/account')
    expect(res?.status()).toBeLessThan(400)
    await expect(page).not.toHaveURL(/\/login/)
    await setTheme(page, 'dark')
    await stabilize(page)
    await expect(page).toHaveScreenshot('account-dark.png', shot(page))
  })

  test('на публикации реакции разблокированы (нет гейта «Войдите»)', async () => {
    await page.goto('/publication/rm')
    await stabilize(page)
    // Залогиненному гейта реакций быть не должно.
    await expect(page.getByText('Войдите, чтобы поставить реакцию')).toHaveCount(0)
  })
})
