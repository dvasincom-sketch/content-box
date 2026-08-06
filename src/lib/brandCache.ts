/**
 * Инлайн-скрипт: кэширует активные бренд-цвета пресета тенанта в localStorage
 * под ключом `cb-brand` (по режиму light/dark). Нужен экрану переподключения из
 * service worker (public/sw.js): он статичен и тенант-агностичен, поэтому читает
 * цвета отсюда, чтобы краситься под тему фан-сайта, а не хардкод-фиолетовым.
 *
 * Ставится в <head> ПОСЛЕ presetThemeCss (<style> уже распаршен) и после THEME_INIT
 * (класс .theme-* и color-scheme уже проставлены) — тогда getComputedStyle отдаёт
 * значения --brand-* текущего режима. Пишем только текущий режим; второй режим
 * докэшируется при переключении темы. Тихо no-op при любой ошибке.
 */
export const BRAND_CACHE = `(function(){try{var cs=getComputedStyle(document.documentElement);function g(n){return (cs.getPropertyValue(n)||'').trim();}var mode=document.documentElement.classList.contains('theme-light')?'light':'dark';var cur={bg:g('--brand-bg'),surface:g('--brand-surface'),text:g('--brand-text'),primary:g('--brand-primary'),accent:g('--brand-accent')};if(!cur.bg)return;var all={};try{all=JSON.parse(localStorage.getItem('cb-brand')||'{}')||{};}catch(e){}all[mode]=cur;localStorage.setItem('cb-brand',JSON.stringify(all));}catch(e){}})();`
