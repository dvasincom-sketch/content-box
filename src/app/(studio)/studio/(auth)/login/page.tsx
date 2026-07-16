import React from 'react'
import { LoginForm } from './LoginForm'

/**
 * Экран входа автора. Guard в layout уже редиректит сюда неавторизованных и
 * уводит отсюда авторизованных, поэтому страница сама рендерит только форму.
 */
export default function StudioLoginPage() {
  return (
    <div className="studio-login">
      <div className="studio-login__card">
        <div className="studio-login__head">
          <h1>Вход в Студию</h1>
          <p>Управление публикациями вашего сайта</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
