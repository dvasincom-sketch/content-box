import React from 'react'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { RedeemForm } from './RedeemForm'
import type { Metadata } from 'next'
import '../../styles.css'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Активировать подарок' }
}

export default async function GiftRedeemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const code = typeof sp?.code === 'string' ? sp.code : ''
  const ctx = await getTenantFromHeaders()
  const settings = (ctx as any)?.settings ?? null

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-md mx-auto px-4 py-12">
        <RedeemForm initialCode={code} />
      </div>
    </main>
  )
}
