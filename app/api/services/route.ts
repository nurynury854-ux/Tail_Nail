import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseConfig, supabase } from '@/lib/supabase'
import { SERVICES } from '@/lib/types'

export async function GET() {
  if (!hasSupabaseConfig || !supabase) {
    return NextResponse.json(SERVICES)
  }

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('service_type', { ascending: true })
    .order('is_addon', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseConfig || !supabase) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const body = await request.json()
  const { name, duration_minutes, price, description, service_type, is_addon, is_active } = body as {
    name?: string
    duration_minutes?: number
    price?: number
    description?: string
    service_type?: 'main' | 'addon'
    is_addon?: boolean
    is_active?: boolean
  }

  if (!name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const normalizedType = service_type || (is_addon ? 'addon' : 'main')

  const { data, error } = await supabase
    .from('services')
    .insert({
      name: name.trim(),
      duration_minutes: duration_minutes ?? null,
      price: price ?? 0,
      description: description?.trim() || null,
      service_type: normalizedType,
      is_addon: Boolean(is_addon ?? normalizedType === 'addon'),
      is_active: Boolean(is_active ?? true),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
