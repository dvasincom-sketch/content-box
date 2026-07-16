import React from 'react'
import { LoginForm } from './LoginForm'
import { BrandLogo } from '@/components/studio/BrandLogo'

/**
 * Экран входа автора. Guard в layout редиректит сюда неавторизованных и уводит
 * отсюда авторизованных, поэтому страница рендерит только форму + оформление.
 *
 * Фон: тёмная подложка + сетка, по которой ПРОБЕГАЕТ СВЕЧЕНИЕ. Две световые
 * волны (горизонтальная и диагональная) медленно катятся по линиям сетки.
 * Анимируется background-position — GPU-дёшево, плавно, без рывков.
 * Слой декоративный, aria-hidden.
 */
export default function StudioLoginPage() {
  return (
    <div className="studio-login">
      <div className="studio-login__bg" aria-hidden>
        <span className="studio-login__grid" />
        <span className="studio-login__sweep studio-login__sweep--h" />
        <span className="studio-login__sweep studio-login__sweep--d" />
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
