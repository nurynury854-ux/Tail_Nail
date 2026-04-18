import { Booking, Branch, Service, TimeSlot } from './types'

// Convert "HH:MM" to minutes since midnight
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Convert minutes since midnight to "HH:MM"
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Get working hours for a given date
export function getWorkingHours(date: Date): { open: number; close: number } | null {
  const day = date.getDay() // 0=Sun, 1=Mon, ..., 6=Sat

  if (day === 0) return null // Sunday - closed

  if (day === 6) {
    // Saturday
    return { open: 10 * 60, close: 18 * 60 }
  }

  // Monday–Friday
  return { open: 10 * 60, close: 20 * 60 }
}

export function isDateClosed(date: Date): boolean {
  return date.getDay() === 0
}

// Generate available time slots for a branch/service/date combination
export function generateTimeSlots(
  date: Date,
  branch: Branch,
  service: Service,
  existingBookings: Booking[]
): TimeSlot[] {
  const hours = getWorkingHours(date)
  if (!hours) return []

  const { open, close } = hours
  const slots: TimeSlot[] = []
  const BUFFER = 5 // 5-minute buffer between bookings

  // Generate hourly slots
  for (let start = open; start < close; start += 60) {
    const end = start + service.duration_minutes + BUFFER

    // Slot must end within working hours (ignoring buffer for close time check)
    if (start + service.duration_minutes > close) continue

    // Count how many existing bookings overlap with this slot window
    const overlapping = existingBookings.filter((booking) => {
      const bStart = timeToMinutes(booking.start_time)
      const bEnd = timeToMinutes(booking.end_time)
      // Check if time windows overlap (including buffer)
      return bStart < end && bEnd > start
    })

    slots.push({
      time: minutesToTime(start),
      available: overlapping.length < branch.staff_count,
      bookingsCount: overlapping.length,
    })
  }

  return slots
}

// Calculate end time for a booking
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const startMinutes = timeToMinutes(startTime)
  return minutesToTime(startMinutes + durationMinutes)
}

// Format date to YYYY-MM-DD
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Format display date
export function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Simulate LINE message notification
export function sendLineMessage(lineId: string, message: string): void {
  console.log(`[LINE Message] Sent to ${lineId}: ${message}`)
}

// Generate booking confirmation message
export function generateConfirmationMessage(booking: {
  customerName: string
  branchName: string
  serviceName: string
  date: string
  startTime: string
}): string {
  return (
    `Hello ${booking.customerName}! ✨ Your appointment at Lumière Nails (${booking.branchName}) ` +
    `has been confirmed.\n\n` +
    `📅 Date: ${formatDisplayDate(booking.date)}\n` +
    `⏰ Time: ${booking.startTime}\n` +
    `💅 Service: ${booking.serviceName}\n\n` +
    `We look forward to seeing you! Please arrive 5 minutes early. 🌸`
  )
}

// Price formatter
export function formatPrice(price: number): string {
  return `NT$${price.toLocaleString()}`
}

// Duration formatter
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}
