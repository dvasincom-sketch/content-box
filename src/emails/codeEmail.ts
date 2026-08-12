/**
 * Простое письмо с 6-значным кодом: подтверждение e-mail автора или привязка
 * телефона к существующему аккаунту. Самодостаточное, без внешних шаблонов.
 */
export function codeEmail(code: string, purpose: 'verify' | 'link'): { subject: string; html: string } {
  const title = purpose === 'link' ? 'Привязка телефона к аккаунту' : 'Подтверждение e-mail'
  const lead = purpose === 'link'
    ? 'Чтобы привязать номер телефона к этому аккаунту, введите код в студии:'
    : 'Чтобы подтвердить адрес электронной почты, введите код в профиле:'
  const subject = purpose === 'link' ? `Код привязки: ${code}` : `Код подтверждения: ${code}`
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e8eb">
      <tr><td style="padding:28px 32px 8px">
        <div style="font-size:13px;color:#8a8f98;font-weight:600;letter-spacing:.04em;text-transform:uppercase">Content Box</div>
        <h1 style="margin:8px 0 0;font-size:20px">${title}</h1>
      </td></tr>
      <tr><td style="padding:8px 32px 4px;font-size:15px;line-height:1.5;color:#3a3f47">${lead}</td></tr>
      <tr><td style="padding:16px 32px 8px">
        <div style="font-size:32px;font-weight:800;letter-spacing:.18em;background:#f1f2f4;border-radius:10px;padding:16px;text-align:center">${code}</div>
      </td></tr>
      <tr><td style="padding:8px 32px 28px;font-size:13px;line-height:1.5;color:#8a8f98">Код действует 5 минут. Если вы не запрашивали его — просто проигнорируйте письмо.</td></tr>
    </table>
  </td></tr></table>
  </body></html>`
  return { subject, html }
}
