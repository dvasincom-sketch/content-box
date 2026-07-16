import React from 'react'
import { LoginForm } from './LoginForm'
import { BrandLogo } from '@/components/studio/BrandLogo'

/**
 * Экран входа автора. Guard в layout редиректит сюда неавторизованных и уводит
 * отсюда авторизованных, поэтому страница рендерит только форму + оформление.
 *
 * Фон: монохромный градиент + медленно плавающие размытые пятна (декоративный
 * слой aria-hidden). Всё сдержанно, в стиле студии.
 */
export default function StudioLoginPage() {
  return (
    <div className="studio-login">
      {/* Декоративный фон */}
      <div className="studio-login__bg" aria-hidden>
        <span className="studio-login__blob studio-login__blob--1" />
        <span className="studio-login__blob studio-login__blob--2" />
        <span className="studio-login__blob studio-login__blob--3" />
        <span className="studio-login__grid" />
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
