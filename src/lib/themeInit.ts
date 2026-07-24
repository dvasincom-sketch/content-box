/**
 * Инлайн-скрипт инициализации темы, встраиваемый в <head> до гидратации.
 *
 * Читает localStorage['theme'] (по умолчанию 'dark'), вешает на <html> класс
 * `theme-<t>` и `color-scheme`, чтобы не мигало светлой темой на первой отрисовке.
 * Тема общая для всех оболочек — ключ localStorage один и тот же.
 *
 * Единый источник для трёх шеллов ((frontend) / (studio) / (signup)) и лендинга.
 * Это строка, а не модуль, потому что исполняется как <script> до React.
 */
export const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.classList.add('theme-'+t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add('theme-dark');}})();`
