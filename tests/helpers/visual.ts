import { expect, type Page, type Locator } from '@playwright/test'

/**
 * Хелперы визуального QA. Скриншоты детерминим (гасим анимации, маскируем
 * динамику). ВАЖНО: скриншот-регрессия имеет смысл против СТАБИЛЬНОГО стенда
 * (localhost + посев). Против ЖИВОГО прода контент/картинки/карусель меняются
 * между попытками → пиксель-дифф «мигает». Поэтому snapshot() умеет выключаться
 * флагом E2E_SNAPSHOTS=off (его ставит прод-прогон): там гоняем ТОЛЬКО функц.
 * ассерты — детерминированный зелёный/красный.
 */
export const DESKTOP = { width: 1440, height: 900 }
export const MOBILE = { width: 390, height: 844 }

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

export function dynamicMasks(page: Page): Locator[] {
  return [page.locator('img'), page.locator('time, [datetime]'), page.locator('[data-visual-dynamic]')]
}

export function shot(page: Page, extraMask: Locator[] = []) {
  return {
    fullPage: true as const,
    animations: 'disabled' as const,
    mask: [...dynamicMasks(page), ...extraMask],
    maxDiffPixelRatio: 0.02,
  }
}

export async function openStable(page: Page, url: string, theme: 'light' | 'dark'): Promise<number> {
  const res = await page.goto(url)
  await setTheme(page, theme)
  await stabilize(page)
  return res?.status() ?? 0
}

/**
 * Скриншот-регрессия, ОТКЛЮЧАЕМАЯ через E2E_SNAPSHOTS=off.
 * Прод-прогон ставит off (визуальная регрессия против живого контента нестабильна),
 * локальный прогон оставляет включённой (стабильный посев).
 */
export async function snapshot(page: Page, name: string, extraMask: Locator[] = []): Promise<void> {
  if (process.env.E2E_SNAPSHOTS === 'off') return
  await expect(page).toHaveScreenshot(name, shot(page, extraMask))
}
