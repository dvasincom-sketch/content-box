import type { Page, Locator } from '@playwright/test'

/**
 * Хелперы визуального QA-прогона.
 *
 * Философия та же, что в frontend.e2e.spec.ts: не фиксируем точные тексты
 * (контент у тенанта меняется), проверяем структуру + делаем скриншот-регрессию.
 * Скриншоты детерминим: гасим анимации/переходы и МАСКИРУЕМ динамику (картинки
 * из S3/оптимизатора, даты, счётчики, авто-карусель героя), иначе toHaveScreenshot
 * мигает от прогона к прогону.
 */

export const DESKTOP = { width: 1440, height: 900 }
export const MOBILE = { width: 390, height: 844 }

/** Гасим анимации/переходы, ждём шрифты и сеть. Вызывать ПОСЛЕ goto, до скриншота. */
export async function stabilize(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;' +
      'caret-color:transparent!important;scroll-behavior:auto!important}',
  })
  await page.evaluate(() => (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready).catch(() => {})
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(400)
}

/** Принудительная тема: класс на <html> + localStorage (как это делает ThemeToggle). */
export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    const root = document.documentElement
    root.classList.remove('theme-light', 'theme-dark')
    root.classList.add('theme-' + t)
    ;(root.style as CSSStyleDeclaration).colorScheme = t
    try {
      localStorage.setItem('theme', t)
    } catch {
      /* приватный режим */
    }
  }, theme)
  await page.waitForTimeout(100)
}

/**
 * Динамика под маску: КАРТИНКИ (грузятся из S3/next-image, иногда моргают),
 * даты/время и всё, помеченное конвенцией data-visual-dynamic (счётчики, карусель).
 */
export function dynamicMasks(page: Page): Locator[] {
  return [page.locator('img'), page.locator('time, [datetime]'), page.locator('[data-visual-dynamic]')]
}

/** Единые опции toHaveScreenshot: полный кадр, маска динамики, допуск на анти-алиасинг. */
export function shot(page: Page, extraMask: Locator[] = []) {
  return {
    fullPage: true as const,
    animations: 'disabled' as const,
    mask: [...dynamicMasks(page), ...extraMask],
    maxDiffPixelRatio: 0.02,
  }
}

/** Навигация + базовые ассерты живой страницы тенанта + установка темы + стабилизация. */
export async function openStable(
  page: Page,
  url: string,
  theme: 'light' | 'dark',
): Promise<number> {
  const res = await page.goto(url)
  await setTheme(page, theme)
  await stabilize(page)
  return res?.status() ?? 0
}
