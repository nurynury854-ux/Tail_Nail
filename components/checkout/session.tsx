'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { CheckoutRole } from '@/lib/checkoutTypes'

export interface ClientSession {
  accountId: string
  role: CheckoutRole
  branchId: string | null
  stylistId: string | null
  displayName: string
  username: string
}

interface SessionContextValue {
  session: ClientSession | null
  loading: boolean
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: true,
  refresh: async () => {},
})

export function CheckoutSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ClientSession | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const res = await fetch('/api/checkout/me', { cache: 'no-store' })
      if (res.ok) setSession(await res.json())
      else setSession(null)
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <SessionContext.Provider value={{ session, loading, refresh }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useCheckoutSession() {
  return useContext(SessionContext)
}

export const ROLE_LABELS: Record<CheckoutRole, string> = {
  owner: '老闆',
  manager: '店長',
  stylist: '美甲師',
}

export function formatNTD(n: number): string {
  return `NT$ ${Math.round(n || 0).toLocaleString('en-US')}`
}
