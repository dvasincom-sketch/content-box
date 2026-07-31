'use client'

// Границы ошибок фан-сайта. Без своего error.tsx любая осечка маршрута падала на
// голый встроенный экран Next «This page couldn't load». RouteError после деплоя
// сам тихо перезагружает страницу при ChunkLoadError, иначе — брендовый экран.
import { RouteError } from '@/components/RouteError'

export default function FrontendError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={props.error} />
}
