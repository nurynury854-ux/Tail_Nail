import { Booking, Branch, SelectedServiceItem, Service, TimeSlot } from './types'

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

// Get working hours for a given date — open every day 11:00–21:00 by default
export function getWorkingHours(_date: Date): { open: number; close: number } | null {
  return { open: 11 * 60, close: 21 * 60 }
}

export function defaultWorkingHoursByDay(_day: number): { open: number; close: number } | null {
  return { open: 11 * 60, close: 21 * 60 }
}

export function isDateClosed(_date: Date): boolean {
  return false
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
  const duration = service.duration_minutes || 120

  // Generate hourly slots
  for (let start = open; start < close; start += 60) {
    const end = start + duration + BUFFER

    // Slot must end within working hours (ignoring buffer for close time check)
    if (start + duration > close) continue

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
  return date.toLocaleDateString('zh-TW', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function isValidTaiwanMobile(phone: string): boolean {
  return /^09\d{8}$/.test(phone)
}

export function calculateSelectedServicesDuration(services: SelectedServiceItem[]): number {
  return services.reduce((sum, item) => sum + item.duration_minutes, 0)
}

export function formatSelectedServicesLine(services: SelectedServiceItem[]): string {
  return services
    .map((item) => `${item.service_name || item.service_id}${item.is_pending ? '（暫估）' : ''}`)
    .join(' + ')
}

// Simulate LINE message notification
export function sendLineMessage(lineId: string, message: string): void {
  console.log(`[LINE Message] Sent to ${lineId}: ${message}`)
}

// Generate booking confirmation message
export function generateConfirmationMessage(booking: {
  customerName: string
  branchName: string
  serviceLine: string
  date: string
  startTime: string
  endTime: string
  phone?: string
  stylistName?: string
}): string {
  const stylistLine = booking.stylistName ? booking.stylistName : '不指定'

  return (
    `✅ 預約確認通知 | 小尾巴美甲\n\n` +
    `親愛的 ${booking.customerName}，您的預約已成功建立！\n\n` +
    `📍 分店：${booking.branchName}\n` +
    `💅 服務項目：${booking.serviceLine}\n` +
    `👩‍🎨 美甲師：${stylistLine}\n` +
    `📅 日期：${formatDisplayDate(booking.date)}\n` +
    `⏰ 時間：${booking.startTime} – ${booking.endTime}\n` +
    `📞 聯絡電話：${booking.phone || '未填寫'}\n\n` +
    `如需更改或取消，請直接聯繫我們 🙏\n` +
    `小尾巴美甲 Ttail Nail`
  )
}

export function generateCancellationMessage(booking: {
  customerName: string
  branchName: string
  date: string
  startTime: string
}): string {
  return (
    `❌ 預約取消通知 | 小尾巴美甲\n\n` +
    `親愛的 ${booking.customerName}，\n\n` +
    `您原定於 ${formatDisplayDate(booking.date)} ${booking.startTime} 在 ${booking.branchName} 的預約已由店家取消。\n\n` +
    `如有疑問或需重新預約，歡迎再次聯繫我們！\n` +
    `對您造成不便，深感抱歉 🙇\n\n` +
    `小尾巴美甲 Ttail Nail`
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
