import { NextRequest, NextResponse } from 'next/server'
import { supabase, hasSupabaseConfig } from '@/lib/supabase'

// GET /api/service-durations?stylist_id=X&category=hand
// GET /api/service-durations?branch_id=X&category=hand  → returns MAX per service across all branch stylists
// Returns: { [service_id]: duration_minutes }
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const stylistId = searchParams.get('stylist_id')
  const branchId = searchParams.get('branch_id')
  const category = searchParams.get('category')

  if (!hasSupabaseConfig || !supabase) return NextResponse.json({})

  if (stylistId) {
    let query = supabase
      .from('service_durations')
      .select('service_id, duration_minutes, is_pending')
      .eq('stylist_id', stylistId)
    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) return NextResponse.json({}, { status: 500 })

    const map: Record<string, number> = {}
    for (const row of data || []) {
      if (!row.is_pending && row.duration_minutes) {
        map[row.service_id] = row.duration_minutes
      }
    }
    return NextResponse.json(map)
  }

  if (branchId) {
    const { data: stylistData } = await supabase
      .from('stylists')
      .select('id')
      .eq('branch_id', branchId)
      .eq('is_active', true)

    const stylistIds = (stylistData || []).map((s: { id: string }) => s.id)
    if (stylistIds.length === 0) return NextResponse.json({})

    let query = supabase
      .from('service_durations')
      .select('service_id, duration_minutes')
      .in('stylist_id', stylistIds)
      .eq('is_pending', false)
    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) return NextResponse.json({}, { status: 500 })

    const map: Record<string, number> = {}
    for (const row of data || []) {
      if (row.duration_minutes) {
        map[row.service_id] = Math.max(map[row.service_id] || 0, row.duration_minutes)
      }
    }
    return NextResponse.json(map)
  }

  return NextResponse.json({}, { status: 400 })
}
