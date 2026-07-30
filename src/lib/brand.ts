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
/**
 * CSS-переменные в inline-стилях: React.CSSProperties их не описывает, и вместо
 * типа тут стояло `['--x' as any]`. Индексная сигнатура по `--*` решает это без
 * каста — и заодно запрещает опечатку вроде `-font-heading`.
 */
type CSSVars = React.CSSProperties & Record<`--${string}`, string>

export function brandVars(settings?: { themePreset?: string | null } | null): CSSVars {
  const preset = getPreset(settings?.themePreset)
  return {
    ['--font-heading']: FONT_STACK[preset.fonts.heading],
    ['--font-body']: FONT_STACK[preset.fonts.body],
    ['--text-size']: '18px',
    ['--text-weight']: '400',
    ['--heading-weight']: '700',
  }
}
