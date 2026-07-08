export default function DomainNotFound() {
  return (
    <div style={{ padding: 48, fontFamily: 'system-ui', color: '#F5F3FF', background: '#0F0A1E', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Тенант не определён</h1>
      <p style={{ opacity: 0.7 }}>
        Домен не привязан к активному тенанту. Проверьте поле <code>domain</code> в админке.
      </p>
    </div>
  )
}
