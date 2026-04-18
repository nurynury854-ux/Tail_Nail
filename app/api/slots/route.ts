import { NextRequest, NextResponse } from 'next/server'
import { supabase, hasSupabaseConfig } from '@/lib/supabase'
import { BRANCHES, SERVICES, Booking } from '@/lib/types'
import { generateTimeSlots } from '@/lib/bookingUtils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const branchId = searchParams.get('branch_id')
  const date = searchParams.get('date') // YYYY-MM-DD
  const serviceId = searchParams.get('service_id')

  if (!branchId || !date || !serviceId) {
    return NextResponse.json({ error: 'Missing required params: branch_id, date, service_id' }, { status: 400 })
  }

  const branch = BRANCHES.find((b) => b.id === branchId)
  const service = SERVICES.find((s) => s.id === serviceId)

  if (!branch || !service) {
    return NextResponse.json({ error: 'Invalid branch or service' }, { status: 400 })
  }

  // Parse date
  const [year, month, day] = date.split('-').map(Number)
  const dateObj = new Date(year, month - 1, day)

  if (!hasSupabaseConfig || !supabase) {
    const slots = generateTimeSlots(dateObj, branch, service, [])
    return NextResponse.json({ slots, source: 'fallback' })
  }

  try {
    // Fetch existing confirmed bookings for this branch/date
    const { data: existingBookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('branch_id', branchId)
      .eq('date', date)
      .eq('status', 'confirmed')

    if (error) {
      console.error('Supabase error:', error)
      // Fallback: generate slots with no existing bookings
      const slots = generateTimeSlots(dateObj, branch, service, [])
      return NextResponse.json({ slots, source: 'fallback' })
    }

    const slots = generateTimeSlots(dateObj, branch, service, (existingBookings || []) as Booking[])
    return NextResponse.json({ slots, source: 'database' })
  } catch (err) {
    console.error('Slots API error:', err)
    // Fallback
    const slots = generateTimeSlots(dateObj, branch, service, [])
    return NextResponse.json({ slots, source: 'fallback' })
  }
}
