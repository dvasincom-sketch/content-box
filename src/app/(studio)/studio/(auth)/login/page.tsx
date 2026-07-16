import React from 'react'
import { LoginForm } from './LoginForm'
import { BrandLogo } from '@/components/studio/BrandLogo'

/**
 * Экран входа автора. Guard в layout редиректит сюда неавторизованных и уводит
 * отсюда авторизованных, поэтому страница рендерит только форму + оформление.
 *
 * Фон: тёмная подложка + сетка со СВЕТЯЩИМИСЯ УЗЛАМИ. Узлы (точки в пересечениях)
 * мягко разгораются и гаснут вразнобой — анимируется только opacity, поэтому
 * плавно и без рывков (в отличие от прежних blur-пятен). Слой декоративный,
 * aria-hidden.
 */

// Позиции светящихся узлов в % (кратны шагу сетки визуально, но заданы вручную
// для «случайного» вида). Каждый со своей задержкой и длительностью.
const NODES = [
  { x: 12, y: 18, d: 0.0, dur: 3.2 },
  { x: 28, y: 62, d: 1.1, dur: 4.0 },
  { x: 44, y: 30, d: 2.3, dur: 3.6 },
  { x: 68, y: 22, d: 0.6, dur: 4.4 },
  { x: 82, y: 54, d: 1.8, dur: 3.4 },
  { x: 74, y: 78, d: 2.9, dur: 4.2 },
  { x: 20, y: 84, d: 0.9, dur: 3.8 },
  { x: 56, y: 70, d: 2.1, dur: 3.5 },
  { x: 90, y: 16, d: 1.4, dur: 4.1 },
  { x: 38, y: 46, d: 3.0, dur: 3.9 },
]

export default function StudioLoginPage() {
  return (
    <div className="studio-login">
      {/* Декоративный фон: подложка + сетка + светящиеся узлы */}
      <div className="studio-login__bg" aria-hidden>
        <span className="studio-login__grid" />
        <div className="studio-login__nodes">
          {NODES.map((n, i) => (
            <span
              key={i}
              className="studio-login__node"
              style={{
                left: `${n.x}%`,
                top: `${n.y}%`,
                animationDelay: `${n.d}s`,
                animationDuration: `${n.dur}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="studio-login__card">
        <div className="studio-login__head">
          <div className="studio-login__logo">
            <BrandLogo size={44} blink />
          </div>
          <h1>Вход в Студию</h1>
          <p>Контент Бокс · управление публикациями</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
