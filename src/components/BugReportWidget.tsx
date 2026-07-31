'use client'

import { useState } from 'react'

/**
 * Плавающая плашка «Нашёл баг» + модалка отчёта (баг-баунти).
 *
 * Всегда видна снизу-справа. Автоматически снимает текущую страницу (URL +
 * заголовок) и размер экрана — пользователь пишет только описание. Два сценария:
 *  - авторизован (`authed`): отчёт привязывается к нему, за подтверждённый баг —
 *    очки; кнопка активна сразу;
 *  - гость: либо войти (ссылка), либо отправить анонимно — тогда обязательна
 *    галочка согласия, и только после неё кнопка активна.
 *
 * Клиентский компонент: работает и на сайте, и в студии. Оформление — на
 * дизайн-токенах (`--brand-*`) с запасными значениями, чтобы не зависеть от
 * контекста темы.
 */
type Props = {
  authed: boolean
  source?: 'site' | 'studio'
  /** Куда вести гостя за входом (на сайте — /account, в студии не показываем). */
  loginHref?: string | null
  /** Показывать «очковую» подачу (сайт-подписчики). В студии авторы очков не
   *  получают, поэтому подача нейтральная. */
  rewards?: boolean
}

type Phase = 'idle' | 'sending' | 'done' | 'error'

export function BugReportWidget({
  authed,
  source = 'site',
  loginHref = '/account',
  rewards = true,
}: Props) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [consent, setConsent] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')

  const canSubmit =
    description.trim().length >= 5 && (authed || consent) && phase !== 'sending'

  function reset() {
    setDescription('')
    setConsent(false)
    setPhase('idle')
    setError('')
  }

  function close() {
    setOpen(false)
    // Сбрасываем чуть позже, чтобы не мигало во время закрытия.
    setTimeout(reset, 200)
  }

  async function submit() {
    if (!canSubmit) return
    setPhase('sending')
    setError('')
    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
          pageTitle: typeof document !== 'undefined' ? document.title : '',
          source,
          // Гость всегда анонимно; авторизованный — по имени (не анонимно).
          anonymous: !authed,
          viewport:
            typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error || 'Не удалось отправить. Попробуйте позже.')
        setPhase('error')
        return
      }
      setPhase('done')
    } catch {
      setError('Сеть недоступна. Попробуйте позже.')
      setPhase('error')
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {!open && (
        <button
          type="button"
          className="cb-bug-fab"
          onClick={() => setOpen(true)}
          aria-label="Сообщить об ошибке"
        >
          <span className="cb-bug-fab-ico" aria-hidden>🐞</span>
          <span className="cb-bug-fab-txt">Нашёл баг?</span>
        </button>
      )}

      {open && (
        <div className="cb-bug-overlay" role="dialog" aria-modal="true" aria-label="Сообщить об ошибке">
          <div className="cb-bug-modal">
            <button type="button" className="cb-bug-close" onClick={close} aria-label="Закрыть">
              ×
            </button>

            {phase === 'done' ? (
              <div className="cb-bug-done">
                <div className="cb-bug-done-ico" aria-hidden>✓</div>
                <h3 className="cb-bug-title">Спасибо!</h3>
                <p className="cb-bug-sub">
                  {authed
                    ? rewards
                      ? 'Отчёт отправлен. +1 очко сразу, основной бонус — после проверки модератором.'
                      : 'Отчёт отправлен. Спасибо, что помогаете улучшать продукт!'
                    : 'Отчёт отправлен анонимно. Спасибо, что помогаете!'}
                </p>
                <button type="button" className="cb-bug-btn" onClick={close}>
                  Готово
                </button>
              </div>
            ) : (
              <>
                <h3 className="cb-bug-title">Нашли ошибку?</h3>
                <p className="cb-bug-sub">
                  {authed
                    ? rewards
                      ? 'Опишите, что не так. За подтверждённый баг — очки и рост статуса.'
                      : 'Опишите, что не так — поможете сделать продукт лучше.'
                    : 'Опишите, что не так. Мы поощряем находки очками — войдите, чтобы их получать.'}
                </p>

                <textarea
                  className="cb-bug-textarea"
                  placeholder="Что произошло? Что вы делали, что ожидали увидеть?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={4000}
                  rows={5}
                />

                <p className="cb-bug-page">
                  Страница прикрепится автоматически:{' '}
                  <span className="cb-bug-page-url">
                    {typeof window !== 'undefined' ? window.location.pathname : ''}
                  </span>
                </p>

                {!authed && (
                  <label className="cb-bug-consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      Отправить анонимно (без привязки к аккаунту).
                      {loginHref && (
                        <>
                          {' '}
                          <a href={loginHref} className="cb-bug-link">
                            Войти, чтобы получить очки
                          </a>
                        </>
                      )}
                    </span>
                  </label>
                )}

                {phase === 'error' && <p className="cb-bug-err">{error}</p>}

                <div className="cb-bug-actions">
                  <button type="button" className="cb-bug-btn-ghost" onClick={close}>
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="cb-bug-btn"
                    onClick={submit}
                    disabled={!canSubmit}
                  >
                    {phase === 'sending' ? 'Отправляю…' : 'Отправить'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const CSS = `
.cb-bug-fab{position:fixed;right:18px;bottom:18px;z-index:9998;display:inline-flex;align-items:center;gap:8px;
  padding:10px 16px;border:none;border-radius:999px;cursor:pointer;font:600 14px/1 var(--font-body,system-ui,sans-serif);
  color:#fff;background:var(--brand-primary,#7C3AED);box-shadow:0 8px 24px rgba(0,0,0,.28);transition:transform .15s ease,box-shadow .15s ease}
.cb-bug-fab:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(124,58,237,.36)}
.cb-bug-fab-ico{font-size:16px}
@media(max-width:560px){.cb-bug-fab-txt{display:none}.cb-bug-fab{padding:12px}}
.cb-bug-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;
  background:rgba(8,6,16,.55);backdrop-filter:blur(2px);padding:16px}
@media(min-width:560px){.cb-bug-overlay{align-items:center}}
.cb-bug-modal{position:relative;width:100%;max-width:460px;background:var(--brand-surface,#1A1330);
  color:var(--brand-text,#F5F3FF);border:1px solid var(--brand-border,rgba(124,58,237,.25));border-radius:18px;
  padding:22px 22px 20px;box-shadow:0 24px 60px rgba(0,0,0,.5);font-family:var(--font-body,system-ui,sans-serif)}
.cb-bug-close{position:absolute;top:10px;right:12px;border:none;background:transparent;color:inherit;opacity:.6;
  font-size:24px;line-height:1;cursor:pointer;padding:4px}
.cb-bug-close:hover{opacity:1}
.cb-bug-title{margin:0 0 6px;font:700 19px/1.2 var(--font-heading,var(--font-body,system-ui,sans-serif))}
.cb-bug-sub{margin:0 0 14px;font-size:13.5px;opacity:.75;line-height:1.45}
.cb-bug-textarea{width:100%;box-sizing:border-box;resize:vertical;min-height:104px;padding:11px 13px;
  border-radius:12px;border:1px solid var(--brand-border,rgba(124,58,237,.3));background:var(--brand-bg,rgba(0,0,0,.2));
  color:inherit;font:400 14px/1.5 var(--font-body,system-ui,sans-serif);outline:none}
.cb-bug-textarea:focus{border-color:var(--brand-primary,#7C3AED)}
.cb-bug-page{margin:9px 0 0;font-size:12px;opacity:.6}
.cb-bug-page-url{opacity:.9;font-family:ui-monospace,monospace}
.cb-bug-consent{display:flex;gap:9px;align-items:flex-start;margin:13px 0 0;font-size:13px;line-height:1.4;cursor:pointer}
.cb-bug-consent input{margin-top:2px;accent-color:var(--brand-primary,#7C3AED)}
.cb-bug-link{color:var(--brand-primary,#C4B5FD);text-decoration:underline}
.cb-bug-err{margin:11px 0 0;font-size:13px;color:#f87171}
.cb-bug-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
.cb-bug-btn{padding:9px 18px;border:none;border-radius:10px;cursor:pointer;font:600 14px/1 var(--font-body,system-ui,sans-serif);
  color:#fff;background:var(--brand-primary,#7C3AED)}
.cb-bug-btn:disabled{opacity:.5;cursor:not-allowed}
.cb-bug-btn-ghost{padding:9px 16px;border:1px solid var(--brand-border,rgba(124,58,237,.3));border-radius:10px;
  cursor:pointer;font:600 14px/1 var(--font-body,system-ui,sans-serif);color:inherit;background:transparent}
.cb-bug-done{text-align:center;padding:8px 0 4px}
.cb-bug-done-ico{width:52px;height:52px;margin:6px auto 12px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:26px;color:#fff;background:#16A34A}
`
