import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseConfig, createAdminClient } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/adminAuth'
import { SERVICES } from '@/lib/types'

// Service-role client: the anon key ships in the browser bundle, so tables are
// closed to it by RLS and every server read/write goes through this instead.
const db = createAdminClient()

export async function GET() {
  if (!hasSupabaseConfig || !db) {
    return NextResponse.json(SERVICES)
  }

  const { data, error } = await db
    .from('services')
    .select('*')
    .order('service_type', { ascending: true })
    .order('is_addon', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const records = Array.isArray(data) ? [...data] : []

  const canonicalNameById: Record<string, string> = {
    'svc-main-gradient': '漸層',
    'svc-main-french': '法式',
    'svc-main-mirror': '鏡面',
  }

  for (const service of records) {
    const canonicalName = canonicalNameById[service.id]
    if (canonicalName) service.name = canonicalName
  }

  const hasExtensionAddon = records.some((service) => service.id === 'svc-addon-extension')
  if (!hasExtensionAddon) {
    const extensionFallback = SERVICES.find((service) => service.id === 'svc-addon-extension')
    if (extensionFallback) records.push(extensionFallback)
  }

  return NextResponse.json(records)
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!hasSupabaseConfig || !db) {
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

  const { data, error } = await db
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
