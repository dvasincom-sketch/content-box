import React from 'react'

/**
 * Логотип «Контент Бокс» — абстрактный знак: открытая коробка (контейнер
 * контента) с вертикальной кареткой внутри (печатная машинка / курсор ввода).
 * Монохром: рисуется currentColor, поэтому наследует цвет родителя.
 *
 * size — сторона квадрата в px. Каретка может мигать (blink), если передать
 * blink=true (по умолчанию статична, чтобы не отвлекать вне hero-контекстов).
 */
export function BrandLogo({
  size = 40,
  blink = false,
  className,
}: {
  size?: number
  blink?: boolean
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Контент Бокс"
    >
      {/* Коробка: скруглённый контур-контейнер */}
      <rect
        x="6"
        y="10"
        width="36"
        height="30"
        rx="7"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      {/* «Крышка» коробки — горизонтальная линия-клапан сверху */}
      <path
        d="M6 18 H42"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* Каретка внутри — вертикальный штрих (курсор печатной машинки) */}
      <rect
        x="22"
        y="24"
        width="4"
        height="10"
        rx="1"
        fill="currentColor"
        style={blink ? { animation: 'brand-caret-blink 1.05s steps(1) infinite' } : undefined}
      />
      {blink && (
        <style>{`@keyframes brand-caret-blink{0%,50%{opacity:1}50.01%,100%{opacity:0}}`}</style>
      )}
    </svg>
  )
}
