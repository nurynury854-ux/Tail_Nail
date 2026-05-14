import { NextRequest, NextResponse } from 'next/server'
import { UNIVERSAL_DURATIONS } from '@/lib/serviceDurations'

// GET /api/service-durations?category=hand|foot
// Returns fixed universal durations — same for all stylists.
// stylist_id and branch_id params are accepted but ignored.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = (searchParams.get('category') || 'hand') as 'hand' | 'foot'

  const result: Record<string, number> = {}
  for (const [id, durations] of Object.entries(UNIVERSAL_DURATIONS)) {
    result[id] = durations[category]
  }

  return NextResponse.json(result)
}
