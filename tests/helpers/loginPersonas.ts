import type { Page } from '@playwright/test'
import { subscriberUser, studioAuthor } from './seedPersonas'

/**
 * Логин подписчика через фронтовую форму /login (POST /api/subscribers/login).
 * Форма редиректит на '/' при успехе.
 */
export async function loginSubscriber(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('input[type="email"]').first().fill(subscriberUser.email)
  await page.locator('input[type="password"]').first().fill(subscriberUser.password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
}

/**
 * Логин автора студии через /studio/login (POST /api/users/login).
 * Форма редиректит на '/studio' при успехе (онбординг включён в посеве).
 */
export async function loginStudioAuthor(page: Page): Promise<void> {
  await page.goto('/studio/login')
  await page.locator('input[type="email"]').first().fill(studioAuthor.email)
  await page.locator('input[type="password"]').first().fill(studioAuthor.password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL(/\/studio(\/.*)?$/, { timeout: 15_000 })
}
