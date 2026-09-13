'use client'

import React from 'react'
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react'
import { EmailCaptureForm } from '@/components/EmailCaptureForm'

/**
 * Секция «Email» в кабинете подписчика: текущий статус + форма задать/сменить
 * адрес (с подтверждением по ссылке из письма). Для телефонных аккаунтов email
 * синтетический → показываем «не указан».
 */
export function EmailSettings({
  email,
  verified,
}: {
  /** Реальный email или null (для синтетического/пустого). */
  email: string | null
  verified: boolean
}) {
  const status = !email
    ? { icon: <AlertCircle size={16} style={{ color: '#e0821a' }} />, text: 'Email не указан' }
    : verified
    ? { icon: <CheckCircle2 size={16} style={{ color: '#16a34a' }} />, text: `Подтверждён: ${email}` }
    : { icon: <AlertCircle size={16} style={{ color: '#e0821a' }} />, text: `Не подтверждён: ${email}` }

  return (
    <section
      style={{
        marginBottom: 24,
        padding: '18px 20px',
        borderRadius: 16,
        border: '1px solid color-mix(in srgb, var(--brand-text) 12%, transparent)',
        background: 'var(--brand-surface)',
      }}
    >
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: 'var(--brand-text)' }}>
        <Mail size={18} style={{ color: 'var(--brand-primary)' }} /> Почта
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.5, color: 'var(--brand-muted)' }}>
        Нужна для еженедельной рассылки и важных уведомлений о профиле.
      </p>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, marginBottom: 12, color: 'var(--brand-text)' }}>
        {status.icon} {status.text}
      </div>
      <EmailCaptureForm
        initialEmail={email || ''}
        submitLabel={email && !verified ? 'Отправить письмо ещё раз' : 'Сохранить и подтвердить'}
      />
    </section>
  )
}
