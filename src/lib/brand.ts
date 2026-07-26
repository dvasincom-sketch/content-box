import { getPreset, FONT_STACK } from './themePresets'

/**
 * Брендовые токены → CSS-переменные.
 *
 * Раньше здесь инжектились primary/accent + шрифты из «сырых» настроек тенанта
 * (theme/typography). Теперь оформление задаёт ОДИН пресет (site-settings.themePreset):
 *   • шрифты (heading/body) берутся из пресета и инжектятся сюда (от режима
 *     свет/тьма они не зависят — один набор);
 *   • цвета (bg/surface/text/primary/accent) инжектятся отдельно, scoped by class
 *     (.theme-dark / .theme-light) через presetThemeCss() — чтобы тумблер темы
 *     флипал класс и применял нужный вариант мгновенно.
 *
 * Размер/вес текста — фиксированные дефолты: отдельной тонкой настройки у автора
 * больше нет (пресеты кураторские).
 */
export function brandVars(settings?: { themePreset?: string | null } | null): React.CSSProperties {
  const preset = getPreset(settings?.themePreset)
  return {
    ['--font-heading' as any]: FONT_STACK[preset.fonts.heading],
    ['--font-body' as any]: FONT_STACK[preset.fonts.body],
    ['--text-size' as any]: '18px',
    ['--text-weight' as any]: '400',
    ['--heading-weight' as any]: '700',
  }
}
