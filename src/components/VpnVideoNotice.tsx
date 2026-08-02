import { cache } from 'react'
import { headers } from 'next/headers'
import { isForeignViewer } from '@/lib/geo'
import { VpnVideoHint } from '@/app/(frontend)/video/[slug]/VpnVideoHint'

/**
 * Серверная обёртка подсказки про VPN: сама определяет по IP, что посетитель
 * вне РФ, и рендерит закрываемый баннер. Дропается на ЛЮБУЮ страницу с плеером
 * (одиночное видео, видео-плейлист категории, публикация с видео) — без
 * прокидывания флага. Гео-проверку кешируем на запрос (react cache), чтобы при
 * нескольких плеерах не считать несколько раз.
 */
const foreignCached = cache(async () => isForeignViewer(await headers()))

export async function VpnVideoNotice() {
  const foreign = await foreignCached()
  if (!foreign) return null
  return <VpnVideoHint />
}
