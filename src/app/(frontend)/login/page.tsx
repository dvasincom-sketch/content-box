import { redirect } from 'next/navigation'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { LoginForm } from './LoginForm'

/**
 * Вход подписчика. Серверная обёртка: если сессия уже валидна, НЕ показываем
 * форму входа (иначе выходит противоречие — в шапке пользователь «вошёл», а
 * страница просит войти). Отправляем на нужную страницу (?redirect=…, только
 * внутренний путь) или на главную. Саму форму рендерит клиентский LoginForm.
 */
export const dynamic = 'force-dynamic'

function safeRedirect(v: string | string[] | undefined): string {
  const s = typeof v === 'string' ? v : ''
  return s.startsWith('/') && !s.startsWith('//') ? s : '/'
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sub = await getCurrentSubscriber().catch(() => null)
  if (sub) {
    const sp = await searchParams
    redirect(safeRedirect(sp?.redirect))
  }
  return <LoginForm />
}
