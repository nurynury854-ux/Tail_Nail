import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { ensureAllBranchesAssigned } from '@/lib/cleaning'
import { taipeiToday } from '@/lib/dateTW'

export const runtime = 'nodejs'

// GET /api/cron/cleaning — daily 值日生 auto-assignment for every branch.
// Scheduled via vercel.json at 00:00 Taiwan (16:00 UTC). Also safe to call
// manually. Requires CRON_SECRET: Vercel Cron sends it as a Bearer token.
// If CRON_SECRET is unset the endpoint is disabled (the on-read fallback in the
// cleaning GET still assigns today when anyone opens the app).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Supabase 未設定' }, { status: 500 })

  const date = taipeiToday()
  const results = await ensureAllBranchesAssigned(admin, date)
  return NextResponse.json({ date, results })
}
