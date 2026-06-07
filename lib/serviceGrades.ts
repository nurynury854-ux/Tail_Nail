import type { StylistGrade } from './types'

// Services Grade 1 can perform (both hand and foot)
const GRADE1_SERVICE_IDS = new Set([
  'svc-main-solid',
  'svc-main-cat-eye',
  'svc-addon-remove',
  'svc-addon-thicken',
  'svc-addon-care',
  'svc-addon-repair',
])

// Services Grade 2 can perform (foot only)
const GRADE2_FOOT_SERVICE_IDS = new Set([
  'svc-main-solid',
  'svc-addon-remove',
  'svc-addon-care',
])

const GRADE_LEVEL: Record<StylistGrade, number> = {
  grade2: 1,
  grade1: 2,
  special: 3,
}

/**
 * Given the selected service IDs and hand/foot category, returns the minimum
 * stylist grade required to perform them.
 */
export function getMinRequiredGrade(
  serviceIds: string[],
  category: 'hand' | 'foot'
): StylistGrade {
  if (serviceIds.length === 0) return 'grade2'

  const allGrade1 = serviceIds.every((id) => GRADE1_SERVICE_IDS.has(id))
  if (!allGrade1) return 'special'

  if (category === 'foot') {
    const allGrade2 = serviceIds.every((id) => GRADE2_FOOT_SERVICE_IDS.has(id))
    if (allGrade2) return 'grade2'
  }

  return 'grade1'
}

/**
 * Returns true if the stylist's grade meets or exceeds the required grade.
 * Ungraded stylists (null/undefined) cannot take any service.
 */
export function stylistMeetsGrade(
  stylistGrade: StylistGrade | null | undefined,
  requiredGrade: StylistGrade
): boolean {
  if (!stylistGrade) return false
  return GRADE_LEVEL[stylistGrade] >= GRADE_LEVEL[requiredGrade]
}
