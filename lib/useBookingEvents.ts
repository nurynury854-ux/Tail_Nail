'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// How long a page may go without a refetch even if every push is missed.
const SAFETY_NET_POLL_MS = 60_000

/**
 * How fresh the page actually is right now:
 *   'idle'    — nothing selected yet, not watching anything.
 *   'live'    — websocket joined; a change shows up in about a second.
 *   'polling' — no usable socket (Realtime not enabled for the table, missing
 *               NEXT_PUBLIC_SUPABASE_* at build time, a proxy in the way).
 *               Still correct, but only as current as the 60s poll.
 *
 * Pages surface this, because "live" and "a minute behind" look identical on
 * screen and staff have no console to check on a phone.
 */
export type BookingEventsStatus = 'idle' | 'live' | 'polling'

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
export function useBookingEvents(
  branchId: string | null | undefined,
  onChange: () => void,
): BookingEventsStatus {
  const [status, setStatus] = useState<BookingEventsStatus>('idle')

  // Latest callback without resubscribing every time the page's load() identity changes.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (branchId === undefined) {
      setStatus('idle')
      return
    }
    const refetch = () => onChangeRef.current()

    // Channel teardown is async, so a late CLOSED/ERROR from the channel we are
    // replacing must not overwrite the status of the one that replaced it.
    let disposed = false
    const report = (next: BookingEventsStatus) => {
      if (!disposed) setStatus(next)
    }

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
        if (status === 'SUBSCRIBED') {
          report('live')
          refetch()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Not fatal — the poll above still keeps the page current — but say so
          // in the console AND on screen, so a silent misconfiguration is
          // diagnosable by whoever is standing in front of it.
          report('polling')
          if (status !== 'CLOSED') {
            console.warn(`booking_events realtime ${status}; falling back to polling`, err ?? '')
          }
        }
      })
    if (!supabase) {
      report('polling')
      console.warn('Supabase not configured; booking updates fall back to polling')
    }

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(poll)
      if (channel) supabase?.removeChannel(channel)
    }
  }, [branchId])

  return status
}
