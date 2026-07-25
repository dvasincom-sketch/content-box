import { HL_PRE, HL_POST } from '@/search/query'

/**
 * Render Meili highlight sentinels as <mark>, XSS-safe:
 * escape ALL HTML first, then swap the (known, safe) sentinels for <mark>.
 * Works in both server and client components (pure function).
 */
export function highlight(input: string): string {
  const escaped = (input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return escaped
    .split(HL_PRE).join('<mark>')
    .split(HL_POST).join('</mark>')
}
