/**
 * Реестр готовых тем-пресетов (theme-presets-brief.md).
 *
 * Автор в Студии выбирает ОДИН пресет — он задаёт сразу светлую и тёмную
 * палитры И пару шрифтов. Отдельного выбора цветов/шрифта нет: за автора уже
 * подобрали кураторский набор под нишу.
 *
 * Цвета инжектятся серверно, scoped by class (.theme-dark / .theme-light) —
 * см. presetThemeCss(). Тумблер свет/тьма в шапке просто флипает класс, поэтому
 * нужный вариант применяется мгновенно, без ре-рендера и без флеша.
 * Деривативы (--brand-muted/-border, свечения, стекло) остаются формулами в
 * styles.css и подхватывают инжектированные bg/surface/text/primary/accent сами.
 */

/** Пять цветовых токенов, задаваемых пресетом (остальное — деривативы-формулы). */
export type PresetColors = {
  bg: string
  surface: string
  primary: string
  accent: string
  text: string
  /** Необязательный цвет шапки (если пресет хочет шапку, отличную от фона). */
  header?: string
}

/** Ключи шрифтов — совпадают с FONT_STACK ниже и с @font-face (fonts.css / pt-serif.css). */
export type FontKey =
  | 'inter'
  | 'montserrat'
  | 'manrope'
  | 'golos'
  | 'ptsans'
  | 'unbounded'
  | 'roboto'
  | 'ptserif'

export type ThemePreset = {
  /** id — значение enum-поля site-settings.themePreset. */
  id: string
  /** Имя пресета для карточки (RU). */
  name: string
  /** EN-подзаголовок. */
  subtitleEn: string
  /** Подсказка «Подойдёт для: …». */
  niche: string
  /** Пара шрифтов (от режима свет/тьма не зависит — один набор). */
  fonts: { heading: FontKey; body: FontKey }
  /** Имена вариантов (для свотчей в карточке). */
  darkName: string
  lightName: string
  dark: PresetColors
  light: PresetColors
  /** Необязательный фоновый декор пресета (напр. 'palms' — пальмы по бокам). */
  decor?: 'palms'
}

/** CSS-стек по ключу шрифта. Семейства совпадают с @font-face (@fontsource + PT Serif). */
export const FONT_STACK: Record<FontKey, string> = {
  inter: "'Inter Variable', system-ui, sans-serif",
  montserrat: "'Montserrat Variable', system-ui, sans-serif",
  manrope: "'Manrope Variable', system-ui, sans-serif",
  golos: "'Golos Text Variable', system-ui, sans-serif",
  ptsans: "'PT Sans', system-ui, sans-serif",
  unbounded: "'Unbounded Variable', system-ui, sans-serif",
  roboto: "'Roboto Variable', system-ui, sans-serif",
  ptserif: "'PT Serif', Georgia, 'Times New Roman', serif",
}

/** Человекочитаемое имя шрифта (подпись под сэмплом в карточке). */
export const FONT_LABEL: Record<FontKey, string> = {
  inter: 'Inter',
  montserrat: 'Montserrat',
  manrope: 'Manrope',
  golos: 'Golos Text',
  ptsans: 'PT Sans',
  unbounded: 'Unbounded',
  roboto: 'Roboto',
  ptserif: 'PT Serif',
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'neon-dawn',
    name: 'Неоновая заря',
    subtitleEn: 'Neon Dawn',
    niche: 'шоу-бизнес, блогеры, поп-культура, творческие подкасты, музыкальные проекты',
    fonts: { heading: 'unbounded', body: 'manrope' },
    darkName: 'Неоновая заря',
    lightName: 'Лунное затмение',
    dark: { bg: '#0F0A1E', surface: '#1A1330', primary: '#7C3AED', accent: '#EC4899', text: '#F5F3FF' },
    light: { bg: '#F7F5FB', surface: '#FFFFFF', primary: '#7C3AED', accent: '#EC4899', text: '#1E1A2E' },
  },
  {
    id: 'warm-earth',
    name: 'Органика и баланс',
    subtitleEn: 'Warm Earth & Clay',
    niche: 'бьюти, wellness, фитнес, уход за собой, ментальное здоровье, медитации',
    fonts: { heading: 'manrope', body: 'golos' },
    darkName: 'Тёплая терракота',
    lightName: 'Песчаный берег',
    dark: { bg: '#1A1614', surface: '#28221F', primary: '#E08A68', accent: '#9EB29F', text: '#F5EFEA' },
    light: { bg: '#FBF9F5', surface: '#F1ECE4', primary: '#C87A5B', accent: '#7A8B7B', text: '#2C2523' },
  },
  {
    id: 'digital-monolith',
    name: 'Цифровой монолит',
    subtitleEn: 'Nordic Slate & Electric Mint',
    niche: 'бизнес-тренинги, IT, аналитика, стартапы, крипта, инженерия, продуктивность',
    fonts: { heading: 'inter', body: 'roboto' },
    darkName: 'Глубокий графит',
    lightName: 'Скандинавский туман',
    dark: { bg: '#0D1117', surface: '#161B22', primary: '#00FF9D', accent: '#2F81F7', text: '#F0F6FC' },
    light: { bg: '#F4F6F8', surface: '#FFFFFF', primary: '#00D084', accent: '#0969DA', text: '#1F2328' },
  },
  {
    id: 'tropic-sunset',
    name: 'Тропический закат',
    subtitleEn: 'Palm Sunset',
    niche: 'фандом, музыкальные и летние проекты, тропический/яркий бренд, лайфстайл',
    fonts: { heading: 'ptserif', body: 'golos' },
    darkName: 'Пальмовый вечер',
    lightName: 'Кокосовый рассвет',
    // Фиолетовый фон + оранжевые акценты и шапка; пальмы по бокам (decor).
    dark: { bg: '#1A0E29', surface: '#271640', primary: '#F97316', accent: '#A78BFA', text: '#FCF4EC', header: '#F97316' },
    light: { bg: '#F6F0FA', surface: '#FFFFFF', primary: '#EA6A0D', accent: '#7C3AED', text: '#241033', header: '#FB8C2E' },
    decor: 'palms',
  },
  {
    id: 'amber-pulse',
    name: 'Янтарный импульс',
    subtitleEn: 'Amber Kinetic',
    niche: 'образование, детские курсы, маркетинг, языки, лайфстайл-влоги, туториалы',
    fonts: { heading: 'montserrat', body: 'manrope' },
    darkName: 'Ночной костёр',
    lightName: 'Солнечный блик',
    dark: { bg: '#121212', surface: '#1E1E1E', primary: '#FF7A1A', accent: '#4D77FF', text: '#F5F5F5' },
    light: { bg: '#FAF8F5', surface: '#F0EAE1', primary: '#FF6B00', accent: '#2D5BFF', text: '#1A1A1A' },
  },
  {
    id: 'frost',
    name: 'Ледяной иней',
    subtitleEn: 'Frost & Aurora',
    niche: 'фанфики, фандом, сказочные и зимние проекты, читательские сообщества',
    fonts: { heading: 'ptserif', body: 'golos' },
    darkName: 'Полярная ночь',
    lightName: 'Морозное утро',
    dark: { bg: '#0A1622', surface: '#122234', primary: '#5CC8F0', accent: '#A78BFA', text: '#EAF6FF' },
    light: { bg: '#EEF6FC', surface: '#FFFFFF', primary: '#0EA5E9', accent: '#7C3AED', text: '#0F2438' },
  },
]

export const DEFAULT_PRESET_ID = 'neon-dawn'

/** Список валидных id пресетов (валидация save-роута). */
export const PRESET_IDS = THEME_PRESETS.map((p) => p.id)

/** Опции для select-поля Payload (label = «Имя (EN)»). */
export const PRESET_SELECT_OPTIONS = THEME_PRESETS.map((p) => ({
  label: `${p.name} (${p.subtitleEn})`,
  value: p.id,
}))

/** Пресет по id, с откатом на дефолтный (первый). */
export function getPreset(id?: string | null): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0]
}

/**
 * Серверный `<style>` для выбранного пресета: обе версии, scoped by class.
 * Клиентский тумблер флипает .theme-dark/.theme-light — нужный набор токенов
 * применяется мгновенно. Заменяет прежний хардкод цветовых токенов в styles.css.
 */
/** CSS обеих версий из готовой пары палитр (scoped by class). */
export function themeCss(dark: PresetColors, light: PresetColors): string {
  const vars = (c: PresetColors) =>
    `--brand-bg:${c.bg};--brand-surface:${c.surface};--brand-text:${c.text};--brand-primary:${c.primary};--brand-accent:${c.accent}` +
    (c.header ? `;--brand-header:${c.header}` : '')
  return `.theme-dark{${vars(dark)}}.theme-light{${vars(light)}}`
}

export function presetThemeCss(presetId?: string | null): string {
  const p = getPreset(presetId)
  return themeCss(p.dark, p.light)
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Санитайзим набор цветов, подставляя фолбэк по каждому токену. */
function normColors(c: any, fb: PresetColors): PresetColors {
  const hex = (v: any, d: string) => (typeof v === 'string' && HEX_RE.test(v.trim()) ? v.trim() : d)
  const out: PresetColors = {
    bg: hex(c?.bg, fb.bg),
    surface: hex(c?.surface, fb.surface),
    primary: hex(c?.primary, fb.primary),
    accent: hex(c?.accent, fb.accent),
    text: hex(c?.text, fb.text),
  }
  if (typeof c?.header === 'string' && HEX_RE.test(String(c.header).trim())) out.header = String(c.header).trim()
  return out
}

/** true, если набор содержит все 5 обязательных токенов валидными hex. */
export function isValidThemeColors(c: any): boolean {
  return (
    !!c &&
    (['bg', 'surface', 'primary', 'accent', 'text'] as const).every(
      (k) => typeof c[k] === 'string' && HEX_RE.test(String(c[k]).trim()),
    )
  )
}

/** Валидация+нормализация темы из студии (dark+light). null — если невалидна. */
export function sanitizeCustomTheme(input: any): { dark: PresetColors; light: PresetColors } | null {
  if (!input || typeof input !== 'object') return null
  if (!isValidThemeColors(input.dark) || !isValidThemeColors(input.light)) return null
  const base = THEME_PRESETS[0]
  return { dark: normColors(input.dark, base.dark), light: normColors(input.light, base.light) }
}

/**
 * Активная палитра тенанта: своя тема (themeSource='custom' + customTheme.theme)
 * перекрывает цвета пресета; иначе — цвета пресета. Шрифты и декор в MVP остаются
 * от пресета (см. brandVars / layout.tsx).
 */
export function resolveThemeColors(
  settings?: { themePreset?: string | null; themeSource?: string | null } | null,
  customTheme?: { theme?: any } | null,
): { dark: PresetColors; light: PresetColors } {
  const p = getPreset(settings?.themePreset)
  if (settings?.themeSource === 'custom' && customTheme?.theme) {
    return {
      dark: normColors(customTheme.theme.dark, p.dark),
      light: normColors(customTheme.theme.light, p.light),
    }
  }
  return { dark: p.dark, light: p.light }
}
