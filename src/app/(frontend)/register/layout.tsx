import React from 'react'
import type { Metadata } from 'next'

// Страница регистрации — вне поискового индекса (сама страница клиентская,
// поэтому robots задаём через серверный layout этого сегмента).
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
