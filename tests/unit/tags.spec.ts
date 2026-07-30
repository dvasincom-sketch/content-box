import { describe, it, expect } from 'vitest'
import { normalizeTags } from '@/fields/tags'

describe('normalizeTags', () => {
  it('тримит label, считает slug, убирает пустые и дубли по slug', () => {
    const d = normalizeTags({
      tags: [
        { label: '  Are You Sure?!  ' },
        { label: 'BTS' },
        { label: 'bts' }, // дубль по slug
        { label: '' }, // пустой
        { label: 'Шоу и проекты' },
      ],
    })
    expect((d as any).tags).toEqual([
      { label: 'Are You Sure?!', slug: 'are-you-sure' },
      { label: 'BTS', slug: 'bts' },
      { label: 'Шоу и проекты', slug: 'shou-i-proekty' },
    ])
  })

  it('без поля tags не трогает data', () => {
    const d = normalizeTags({ title: 'x' } as any)
    expect(d).toEqual({ title: 'x' })
  })

  it('пустой массив остаётся пустым', () => {
    const d = normalizeTags({ tags: [] })
    expect((d as any).tags).toEqual([])
  })
})
