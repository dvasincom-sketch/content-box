import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

/**
 * Прод-конфиг визуального QA. Гоняем ТОЛЬКО гостевые тесты против ЖИВОГО сайта.
 *
 * Отличия от playwright.config.ts:
 *  - НЕТ globalSetup (он лезет в локальную БД сеять тенант — против прода не нужно);
 *  - НЕТ webServer (не поднимаем localhost dev);
 *  - baseURL = E2E_BASE_URL (по умолчанию прод).
 *
 * Пользовательский/студийный спеки сюда НЕ входят: им нужен посев в локальную БД,
 * а против прода это бессмысленно. Их гонять обычным `npm run test:e2e` на localhost.
 *
 *   npm run test:e2e:prod -- --update-snapshots   # первый раз (бейзлайны прода)
 *   npm run test:e2e:prod                          # сравнение
 *   E2E_BASE_URL=https://btsrussia.ru npm run test:e2e:prod
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /visual-guest\.e2e\.spec\.ts/,
  forbidOnly: !!process.env.CI,
  retries: 1, // прод может дать редкий блип — один ретрай гасит ложное падение
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://btsrussia.ru',
    trace: 'on-first-retry',
    navigationTimeout: 60_000,
    actionTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium' } }],
})
