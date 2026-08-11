'use client'
/**
 * Крошечное клиентское хранилище «текущее видео на странице» — чтобы плавающая
 * кнопка «Спросить Асю» (глобальная, в layout) знала, что открыта страница
 * видео, и меняла заголовок на «Что в этом видео» + показывала саммари. Мост
 * (AsyaVideoBridge) на странице видео пишет сюда id, панель — читает и слушает.
 */
export type AsyaVideo = { id: string | number; minPrice: number } | null
let current: AsyaVideo = null
const subs = new Set<() => void>()

export function setAsyaVideo(v: AsyaVideo): void {
  current = v
  subs.forEach((f) => f())
}
export function getAsyaVideo(): AsyaVideo {
  return current
}
export function subAsyaVideo(f: () => void): () => void {
  subs.add(f)
  return () => { subs.delete(f) }
}
