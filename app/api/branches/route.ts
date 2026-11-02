import { NextRequest, NextResponse } from 'next/server'
import { BRANCHES } from '@/lib/types'
import { hasSupabaseConfig, createAdminClient } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/adminAuth'

// Service-role client: the anon key ships in the browser bundle, so tables are
// closed to it by RLS and every server read/write goes through this instead.
const db = createAdminClient()

export async function GET() {
  if (!hasSupabaseConfig || !db) {
    return NextResponse.json(BRANCHES)
  }

  const { data, error } = await db.from('branches').select('*').order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!hasSupabaseConfig || !admin) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const body = await request.json()
  const { name, address, staff_count, phone, image_url } = body as {
    name?: string
    address?: string
    staff_count?: number
    phone?: string
    image_url?: string
  }

  if (!name || !address) {
    return NextResponse.json({ error: 'name and address are required' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('branches')
    .insert({
      name: name.trim(),
      address: address.trim(),
      staff_count: staff_count ?? 2,
      phone: phone?.trim() || null,
      image_url: image_url?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
