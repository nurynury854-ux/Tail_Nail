import { NextRequest, NextResponse } from 'next/server'
import { supabase, hasSupabaseConfig } from '@/lib/supabase'
import { durationMapForStylist } from '@/lib/serviceDurations'

// GET /api/service-durations?category=hand|foot&stylist_id=...
// Returns the fixed durations, which are the same for every stylist apart from the
// handful of per-stylist exceptions in lib/serviceDurations.ts (不點 on 自帶圖款式).
// Without stylist_id — 不指定, where the stylist is only picked when the booking is
// written — the universal times are returned; /api/bookings then recomputes the real
// duration for whoever it assigns. branch_id is accepted but ignored.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = (searchParams.get('category') || 'hand') as 'hand' | 'foot'
  const stylistId = searchParams.get('stylist_id')

  let stylistName: string | null = null
  if (stylistId && hasSupabaseConfig && supabase) {
    // The name matters because an /admin-created 不點 has a UUID, not sty-budian.
    // A failed (not just empty) lookup must not silently fall through to the
    // universal/shorter duration: the booking page uses this response to size
    // the /api/slots availability check, and POST /api/bookings separately
    // recomputes the real (possibly longer) duration from the full stylist
    // row it already has — a slot checked as free for a too-short duration
    // can end up storing a longer end_time than what was actually validated
    // against other bookings, i.e. a real double-booking risk.
    const { data, error } = await supabase.from('stylists').select('name').eq('id', stylistId).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    stylistName = data?.name ?? null
  }

  return NextResponse.json(durationMapForStylist(category, stylistId ? { id: stylistId, name: stylistName } : null))
}
