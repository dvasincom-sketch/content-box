import { describe, it, expect } from 'vitest'
import { htmlToLexical, lexicalToHtml } from '@/lib/lexical'

/**
 * Регрессия: пункты списка не должны заражаться буквальными тегами <p>.
 *
 * Причина бага: Tiptap/ProseMirror оборачивает содержимое пункта в абзац
 * (<li><p>текст</p></li>), а htmlToLexical отдавал это в parseInline, который
 * знает только inline-теги — <p> попадал в текст буквально и на каждом
 * сохранении удваивался (<p><p>…</p></p>).
 */
const liText = (lex: any, i = 0): string =>
  lex.root.children[0].children[i].children
    .filter((c: any) => c?.type === 'text')
    .map((c: any) => c.text)
    .join('')

describe('lexical: пункты списка без тегов <p>', () => {
  it('снимает обёртку <p> внутри <li>', () => {
    const lex = htmlToLexical('<ul><li><p>Премьера: 19 августа 2020.</p></li></ul>')
    expect(liText(lex)).toBe('Премьера: 19 августа 2020.')
    expect(JSON.stringify(lex)).not.toContain('<p>')
  })

  it('роунд-трип стабилен: <p> не накапливаются при повторном сохранении', () => {
    const editor = '<ul><li><p>Пункт один</p></li><li><p>Пункт два</p></li></ul>'
    const lex1 = htmlToLexical(editor)
    // Повторное сохранение: lexical → html → Tiptap снова оборачивает <li> в <p>.
    const reWrapped = lexicalToHtml(lex1).replace(
      /<li>([\s\S]*?)<\/li>/gi,
      '<li><p>$1</p></li>',
    )
    const lex2 = htmlToLexical(reWrapped)
    expect(liText(lex2, 0)).toBe('Пункт один')
    expect(liText(lex2, 1)).toBe('Пункт два')
    expect(JSON.stringify(lex2)).not.toContain('<p>')
  })

  it('несколько абзацев в пункте → перенос строки, без тегов', () => {
    const lex = htmlToLexical('<ul><li><p>Строка 1</p><p>Строка 2</p></li></ul>')
    expect(liText(lex)).toBe('Строка 1\nСтрока 2')
    expect(JSON.stringify(lex)).not.toContain('<p>')
  })

  it('обычные абзацы не задеты', () => {
    const lex = htmlToLexical('<p>Просто абзац</p>')
    expect(lex.root.children[0].type).toBe('paragraph')
    expect((lex.root.children[0] as any).children[0].text).toBe('Просто абзац')
  })
})
