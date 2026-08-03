'use client'

import BonusAdmin from '@/components/checkout/BonusAdmin'
import MyBonuses from '@/components/checkout/MyBonuses'
import { useCheckoutSession } from '@/components/checkout/session'

export default function BonusesPage() {
  const { session, loading } = useCheckoutSession()

  if (loading) return <p className="text-sm text-warmgray">載入中…</p>
  if (!session) return null

  // Two separate components rather than one with hidden controls, so no edit
  // affordance can reach staff. The API is the real guard: writes are owner-only
  // and reads are scoped to the caller.
  return session.role === 'owner' ? <BonusAdmin /> : <MyBonuses />
}
