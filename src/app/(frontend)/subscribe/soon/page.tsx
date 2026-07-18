import React from 'react'
import Link from 'next/link'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { Clock, ArrowLeft } from 'lucide-react'
import '../../styles.css'

/**
 * Заглушка оформления подписки. Платёжная система ещё не подключена — сюда ведут
 * кнопки «Оформить» с витрины /subscribe. Когда появится оплата, эту страницу
 * заменит реальный чекаут.
 */
export default async function SubscribeSoonPage() {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { settings } = ctx

  return (
    <main
      style={{
        ...brandVars(settings?.theme, settings?.typography),
        background: 'var(--brand-bg)',
        minHeight: '100vh',
      }}
    >
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
          style={{ background: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)' }}
        >
          <Clock size={30} style={{ color: 'var(--brand-primary)' }} />
        </div>

        <h1 className="text-3xl lg:text-4xl font-extrabold mb-4" style={{ color: 'var(--brand-text)' }}>
          Оплата скоро появится
        </h1>

        <p className="text-base mb-8 max-w-md mx-auto" style={{ color: 'var(--brand-text)', opacity: 0.75 }}>
          Мы заканчиваем подключение приёма платежей. Совсем скоро вы сможете оформить
          подписку и открыть весь контент. Спасибо за терпение!
        </p>

        <Link
          href="/subscribe"
          className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl transition-transform hover:-translate-y-0.5"
          style={{ background: 'var(--brand-primary)', color: '#fff' }}
        >
          <ArrowLeft size={16} />
          К тарифам
        </Link>
      </div>
    </main>
  )
}
