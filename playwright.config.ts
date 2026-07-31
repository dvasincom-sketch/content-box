import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Разовый посев перед всеми тестами: активный тенант (иначе localhost уходит
  // в /domain-not-found). Суперадмина для admin-тестов сеет seedTestUser.
  globalSetup: './tests/e2e/global-setup.ts',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Базовый адрес: тесты ходят по относительным путям (`page.goto('/')`).
       Раньше был закомментирован, и адрес хардкодился в каждом тесте. */
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Первый заход на маршрут в `next dev` компилирует его — тяжёлая админка
       не укладывается в дефолтные 30 с. Даём запас, чтобы падения означали
       реальные баги, а не таймаут первой компиляции. */
    navigationTimeout: 120_000,
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    // npm, а не pnpm: проект живёт на npm (package-lock.json, .npmrc), и с
    // `pnpm dev` e2e не запускались вовсе, если pnpm не установлен.
    command: 'npm run dev',
    reuseExistingServer: true,
    url: 'http://localhost:3000',
    // Первый `next dev` собирает проект — минуты. Дефолтных 60 с не хватает.
    timeout: 180_000,
  },
})
