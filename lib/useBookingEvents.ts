'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// How long a page may go without a refetch even if every push is missed.
const SAFETY_NET_POLL_MS = 60_000

/**
 * Keeps a page's booking data current without anyone pressing refresh.
 *
 * The server writes a PII-free row to `booking_events` on every booking change
 * (lib/bookingEvents.ts) and Supabase pushes it over a websocket; `onChange`
 * then re-fetches through the redacting API. A push alone is not enough on
 * phones — Safari drops the socket the moment the screen locks — so the same
 * refetch also runs:
 *   • on SUBSCRIBED, which fires on the first join AND on every rejoin after a
 *     drop, so anything that happened while disconnected is picked up;
 *   • when the tab becomes visible again, without waiting on reconnect backoff;
 *   • on a slow safety-net poll while visible, so a broken socket (Realtime not
 *     enabled for the table, missing env, corporate proxy) degrades to
 *     "at most a minute stale" instead of "stale until reload".
 *
 * `branchId`: a branch id to watch just that branch, `null` to watch every
 * branch, or `undefined` to not subscribe yet (nothing selected).
 */
export function useBookingEvents(branchId: string | null | undefined, onChange: () => void) {
  // Latest callback without resubscribing every time the page's load() identity changes.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (branchId === undefined) return
    const refetch = () => onChangeRef.current()

    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisible)
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') refetch()
    }, SAFETY_NET_POLL_MS)

    const channel = supabase
      ?.channel(`booking-events-${branchId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_events',
          ...(branchId ? { filter: `branch_id=eq.${branchId}` } : {}),
        },
        refetch,
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') refetch()
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Not fatal — the poll above still keeps the page current — but say so
          // in the console so a silent misconfiguration is diagnosable.
          console.warn(`booking_events realtime ${status}; falling back to polling`, err ?? '')
        }
      })
    if (!supabase) console.warn('Supabase not configured; booking updates fall back to polling')

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(poll)
      if (channel) supabase?.removeChannel(channel)
    }
  }, [branchId])
}
