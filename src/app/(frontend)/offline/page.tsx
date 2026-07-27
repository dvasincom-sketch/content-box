/**
 * Страница-заглушка для офлайна (режим PWA «минимум»). Кэшируется сервис-воркером
 * при установке и показывается, если навигация не удалась из-за отсутствия сети.
 */
export default function OfflinePage() {
  return (
    <div style={{ maxWidth: 560, margin: '96px auto', padding: '0 20px', textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', marginBottom: 12 }}>Нет соединения</h1>
      <p style={{ color: 'var(--brand-muted, #8a8a8a)', lineHeight: 1.6 }}>
        Похоже, вы офлайн. Проверьте подключение к интернету и обновите страницу.
      </p>
    </div>
  )
}
