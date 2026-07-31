'use client'

// Границы ошибок студии — та же логика, что и на фан-сайте: после деплоя гасим
// ChunkLoadError авто-перезагрузкой, иначе показываем брендовый экран.
import { RouteError } from '@/components/RouteError'

export default function StudioError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={props.error} />
}
