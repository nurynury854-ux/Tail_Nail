import { NextRequest, NextResponse } from 'next/server'
import { supabase, hasSupabaseConfig } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/stylist-schedule?stylist_id=X
// Returns:
//   weekly_off_days: number[]   — day_of_week (0=Sun) where is_working=false
//   full_off_dates:  string[]   — YYYY-MM-DD dates where is_off=true (next 60 days)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const stylistId = searchParams.get('stylist_id')

  if (!stylistId) {
    return NextResponse.json({ error: 'stylist_id required' }, { status: 400 })
  }

  if (!hasSupabaseConfig || !supabase) {
    return NextResponse.json({ weekly_off_days: [], full_off_dates: [] })
  }

  // Date range: tomorrow through 60 days ahead (Taiwan time)
  const nowTW = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const tomorrow = new Date(nowTW)
  tomorrow.setDate(nowTW.getDate() + 1)
  const until = new Date(nowTW)
  until.setDate(nowTW.getDate() + 61)

  const pad = (n: number) => String(n).padStart(2, '0')
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const fromStr = toDateStr(tomorrow)
  const toStr = toDateStr(until)

  const [{ data: weeklyRows }, { data: overrideRows }] = await Promise.all([
    supabase
      .from('stylist_weekly_hours')
      .select('day_of_week, is_working')
      .eq('stylist_id', stylistId),
    supabase
      .from('stylist_day_overrides')
      .select('date, is_off')
      .eq('stylist_id', stylistId)
      .eq('is_off', true)
      .gte('date', fromStr)
      .lte('date', toStr),
  ])

  const weekly_off_days = (weeklyRows || [])
    .filter((r) => !r.is_working)
    .map((r) => r.day_of_week as number)

  const full_off_dates = (overrideRows || []).map((r) => r.date as string)

  return NextResponse.json({ weekly_off_days, full_off_dates })
}
