export type ServiceDurations = { hand: number; foot: number }

export type StylistRef = { id?: string | null; name?: string | null } | null | undefined

export const UNIVERSAL_DURATIONS: Record<string, ServiceDurations> = {
  'svc-main-solid':        { hand: 60,  foot: 40  },
  'svc-main-cat-eye':      { hand: 90,  foot: 60  },
  'svc-main-gradient':     { hand: 90,  foot: 60  },
  'svc-main-french':       { hand: 90,  foot: 90  },
  'svc-main-mirror':       { hand: 90,  foot: 90  },
  'svc-main-store-style':  { hand: 120, foot: 90  },
  'svc-main-custom-style': { hand: 120, foot: 120 },
  'svc-addon-remove':      { hand: 35,  foot: 35  },
  'svc-addon-care':        { hand: 40,  foot: 60  },
  'svc-addon-shape':       { hand: 20,  foot: 30  },
  'svc-addon-thicken':     { hand: 35,  foot: 35  },
  'svc-addon-extension':   { hand: 60,  foot: 60  },
  'svc-addon-repair':      { hand: 30,  foot: 30  },
}

// Per-stylist exceptions to UNIVERSAL_DURATIONS: 自帶圖款式 is 2h for everyone
// except 不點, who keeps the old 2.5h.
//
// Matched by name as well as by id, because a stylist created from /admin gets a
// UUID instead of the seeded sty-* id — the same reason supabase/seed.sql rows are
// re-matched by name in the spec SQL files.
const STYLIST_DURATION_OVERRIDES: Array<{
  ids: string[]
  names: string[]
  durations: Record<string, ServiceDurations>
}> = [
  {
    ids: ['sty-budian'],
    names: ['不點'],
    durations: { 'svc-main-custom-style': { hand: 150, foot: 150 } },
  },
]

function overridesForStylist(stylist: StylistRef): Record<string, ServiceDurations> {
  if (!stylist) return {}
  const id = stylist.id?.trim()
  const name = stylist.name?.trim()
  const match = STYLIST_DURATION_OVERRIDES.find(
    (row) => (id && row.ids.includes(id)) || (name && row.names.includes(name))
  )
  return match?.durations || {}
}

// Minutes one service takes for this stylist; undefined when the service is unknown.
// Pass no stylist (不指定, or before one is chosen) to get the universal time.
export function durationForStylist(
  serviceId: string,
  category: 'hand' | 'foot',
  stylist?: StylistRef
): number | undefined {
  const durations = overridesForStylist(stylist)[serviceId] ?? UNIVERSAL_DURATIONS[serviceId]
  return durations?.[category]
}

// service_id → minutes for every service, as /api/service-durations returns it.
export function durationMapForStylist(
  category: 'hand' | 'foot',
  stylist?: StylistRef
): Record<string, number> {
  const overrides = overridesForStylist(stylist)
  const result: Record<string, number> = {}
  for (const [id, durations] of Object.entries(UNIVERSAL_DURATIONS)) {
    result[id] = (overrides[id] ?? durations)[category]
  }
  return result
}
