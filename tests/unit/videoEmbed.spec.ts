import { describe, it, expect } from 'vitest'
import { parseVideoEmbed } from '@/lib/videoEmbed'

/**
 * Парсер внешних видео — точка контроля безопасности: он решает, чей iframe
 * окажется на странице. Поэтому проверяем не только «разбирает правильные
 * ссылки», но и «отказывает всему остальному».
 */

describe('VK: обычные ссылки', () => {
  it('ссылка на видео сообщества (отрицательный oid)', () => {
    const r = parseVideoEmbed('https://vkvideo.ru/video-217576166_456247784')
    expect(r?.provider).toBe('vk')
    expect(r?.aspect).toBe('16:9')
    expect(r?.src).toContain('/video_ext.php?')
    expect(r?.src).toContain('oid=-217576166')
    expect(r?.src).toContain('id=456247784')
  })

  it('ссылка на видео пользователя (положительный oid)', () => {
    const r = parseVideoEmbed('https://vk.com/video12345_67890')
    expect(r?.src).toContain('oid=12345')
    expect(r?.src).toContain('id=67890')
  })

  it('клип получает вертикальные пропорции', () => {
    const r = parseVideoEmbed('https://vk.ru/clip-217576166_456247784')
    expect(r?.provider).toBe('vk-clip')
    expect(r?.aspect).toBe('9:16')
  })

  it('лишние query-параметры не мешают', () => {
    const r = parseVideoEmbed('https://vk.com/video-1_2?list=abc&t=30')
    expect(r?.src).toContain('oid=-1')
    expect(r?.src).toContain('id=2')
  })

  it('в обычной ссылке нет хеша — приватное видео так не встроится', () => {
    const r = parseVideoEmbed('https://vk.com/video-1_2')
    expect(r?.src).not.toContain('hash=')
  })
})

describe('VK: готовый код вставки', () => {
  const iframe =
    '<iframe src="https://vk.ru/video_ext.php?oid=-217576166&id=456247784&hash=a6d58f8a7da6b0bd" ' +
    'width="640" height="360" frameborder="0" allowfullscreen="1"></iframe>'

  it('достаёт src из кода и сохраняет ключ доступа', () => {
    const r = parseVideoEmbed(iframe)
    expect(r?.provider).toBe('vk')
    expect(r?.src).toContain('hash=a6d58f8a7da6b0bd')
    expect(r?.src).toContain('oid=-217576166')
  })

  it('исходный хост площадки сохраняется', () => {
    expect(parseVideoEmbed(iframe)?.src.startsWith('https://vk.ru/')).toBe(true)
  })

  it('экранированные амперсанды в атрибуте разбираются', () => {
    const escaped = '<iframe src="https://vk.com/video_ext.php?oid=-1&amp;id=2&amp;hash=deadbeef"></iframe>'
    const r = parseVideoEmbed(escaped)
    expect(r?.src).toContain('id=2')
    expect(r?.src).toContain('hash=deadbeef')
  })

  it('мусорный хеш отбрасывается, а видео остаётся', () => {
    const bad = '<iframe src="https://vk.com/video_ext.php?oid=-1&id=2&hash=../../evil"></iframe>'
    const r = parseVideoEmbed(bad)
    expect(r).not.toBeNull()
    expect(r?.src).not.toContain('evil')
    expect(r?.src).not.toContain('hash=')
  })
})

describe('Дзен', () => {
  it('готовый embed из кода вставки берётся как есть', () => {
    // Публичного описания формата у Дзена нет, поэтому основной путь —
    // довериться коду вставки, проверив только хост.
    const r = parseVideoEmbed('<iframe src="https://dzen.ru/embed/vLwFPQ7CDkeE?from=zen"></iframe>')
    expect(r?.provider).toBe('dzen')
    expect(r?.src).toBe('https://dzen.ru/embed/vLwFPQ7CDkeE?from=zen')
  })

  it('ссылка на страницу видео конвертируется', () => {
    const r = parseVideoEmbed('https://dzen.ru/video/watch/vLwFPQ7CDkeE')
    expect(r?.src).toBe('https://dzen.ru/embed/vLwFPQ7CDkeE')
  })
})

describe('отказы', () => {
  it('чужой хост не проходит', () => {
    expect(parseVideoEmbed('https://example.com/video-1_2')).toBeNull()
    expect(parseVideoEmbed('<iframe src="https://evil.example/x"></iframe>')).toBeNull()
  })

  it('хост-двойник не проходит: сравнение точное, а не по суффиксу', () => {
    expect(parseVideoEmbed('https://evil-vk.com/video-1_2')).toBeNull()
    expect(parseVideoEmbed('https://vk.com.evil.net/video-1_2')).toBeNull()
    expect(parseVideoEmbed('https://notdzen.ru/embed/x')).toBeNull()
  })

  it('javascript: и data: отвергаются', () => {
    expect(parseVideoEmbed('javascript:alert(1)')).toBeNull()
    expect(parseVideoEmbed('<iframe src="javascript:alert(1)"></iframe>')).toBeNull()
    expect(parseVideoEmbed('<iframe src="data:text/html,<script>alert(1)</script>"></iframe>')).toBeNull()
  })

  it('пустой и бессмысленный ввод', () => {
    expect(parseVideoEmbed('')).toBeNull()
    expect(parseVideoEmbed('   ')).toBeNull()
    expect(parseVideoEmbed('просто текст')).toBeNull()
    expect(parseVideoEmbed('https://vk.com/durov')).toBeNull()
  })

  it('video_ext без обязательных параметров', () => {
    expect(parseVideoEmbed('https://vk.com/video_ext.php?hash=abc')).toBeNull()
    expect(parseVideoEmbed('https://vk.com/video_ext.php?oid=-1')).toBeNull()
    expect(parseVideoEmbed('https://vk.com/video_ext.php?oid=abc&id=2')).toBeNull()
  })
})

describe('нормализация', () => {
  it('http поднимается до https', () => {
    expect(parseVideoEmbed('http://vk.com/video-1_2')?.src.startsWith('https://')).toBe(true)
  })

  it('протокол-относительная ссылка из кода вставки', () => {
    const r = parseVideoEmbed('<iframe src="//vk.com/video_ext.php?oid=-1&id=2"></iframe>')
    expect(r?.src.startsWith('https://vk.com/')).toBe(true)
  })

  it('на выходе всегда абсолютный https-адрес', () => {
    for (const input of [
      'https://vk.com/video-1_2',
      'https://vk.ru/clip-1_2',
      'https://dzen.ru/video/watch/abc',
    ]) {
      expect(parseVideoEmbed(input)?.src.startsWith('https://')).toBe(true)
    }
  })
})

describe('устойчивость разбора кода вставки', () => {
  it('src без кавычек', () => {
    const r = parseVideoEmbed('<iframe src=https://vk.com/video_ext.php?oid=-1&id=2 width=640></iframe>')
    expect(r?.src).toContain('oid=-1')
  })

  it('data-src не перебивает настоящий src', () => {
    const r = parseVideoEmbed(
      '<iframe data-src="https://evil.example/x" src="https://vk.com/video_ext.php?oid=-1&id=2"></iframe>',
    )
    expect(r?.src.startsWith('https://vk.com/')).toBe(true)
  })

  it('логин и пароль в адресе вырезаются', () => {
    const r = parseVideoEmbed('<iframe src="https://user:pass@dzen.ru/embed/abc"></iframe>')
    expect(r?.src).toBe('https://dzen.ru/embed/abc')
  })

  it('нестандартный порт отвергается', () => {
    expect(parseVideoEmbed('https://dzen.ru:8443/embed/abc')).toBeNull()
    expect(parseVideoEmbed('https://vk.com:1337/video-1_2')).toBeNull()
  })

  it('перенос строки внутри тега не мешает', () => {
    const r = parseVideoEmbed('<iframe\n  src="https://vk.com/video_ext.php?oid=-1&id=2"\n  width="640"></iframe>')
    expect(r?.src).toContain('id=2')
  })
})
