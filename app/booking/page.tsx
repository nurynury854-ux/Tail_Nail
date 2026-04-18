'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DayPicker } from 'react-day-picker'
import { format, addDays, startOfToday } from 'date-fns'
import toast from 'react-hot-toast'
import { ChevronRight, ChevronLeft, Check, Clock, MapPin, Sparkles, Phone, User, MessageCircle, Loader2 } from 'lucide-react'
import { BRANCHES, SERVICES, Branch, Service, TimeSlot } from '@/lib/types'
import {
  formatPrice,
  formatDuration,
  calculateEndTime,
  formatDisplayDate,
  formatDate,
  isDateClosed,
} from '@/lib/bookingUtils'

import 'react-day-picker/dist/style.css'

type Step = 1 | 2 | 3 | 4 | 5 | 6

interface BookingState {
  branch: Branch | null
  service: Service | null
  date: Date | null
  timeSlot: string | null
  name: string
  lineId: string
  phone: string
  lineNotificationSent?: boolean
}

function BookingContent() {
  const searchParams = useSearchParams()

  const [step, setStep] = useState<Step>(1)
  const [state, setState] = useState<BookingState>({
    branch: null,
    service: null,
    date: null,
    timeSlot: null,
    name: '',
    lineId: '',
    phone: '',
  })
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [slotCheckTime, setSlotCheckTime] = useState<Date | null>(null)

  // Pre-fill from URL params
  useEffect(() => {
    const branchId = searchParams.get('branch')
    const serviceId = searchParams.get('service')
    const userId = searchParams.get('userId')
    let nextStep: Step = 1

    // Pre-fill LINE ID from webhook (hidden from user)
    if (userId) {
      setState((s) => ({ ...s, lineId: userId }))
    }

    if (branchId) {
      const branch = BRANCHES.find((b) => b.id === branchId)
      if (branch) {
        setState((s) => ({ ...s, branch }))
        nextStep = 2
      }
    }
    if (serviceId) {
      const service = SERVICES.find((s) => s.id === serviceId)
      if (service) {
        setState((s) => ({ ...s, service }))
        if (nextStep === 2) nextStep = 3
      }
    }
    setStep(nextStep)
  }, [searchParams])

  // If selected slot becomes unavailable, deselect it and notify user
  useEffect(() => {
    if (!state.timeSlot || !state.date) return
    const selectedSlot = timeSlots.find((s) => s.time === state.timeSlot)
    if (selectedSlot && !selectedSlot.available) {
      setState((s) => ({ ...s, timeSlot: null }))
      toast.error('Your selected time slot just became unavailable. Please choose another.')
    }
  }, [timeSlots, state.timeSlot, state.date])

  // Fetch time slots when branch, service, and date are selected
  const fetchSlots = useCallback(async () => {
    if (!state.branch || !state.service || !state.date) return
    setLoadingSlots(true)
    try {
      const dateStr = formatDate(state.date)
      const res = await fetch(
        `/api/slots?branch_id=${state.branch.id}&date=${dateStr}&service_id=${state.service.id}`
      )
      if (res.ok) {
        const data = await res.json()
        setTimeSlots(data.slots)
        setSlotCheckTime(new Date())
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to load availability' }))
        toast.error(err.error || 'Failed to load availability. Please retry.')
        setTimeSlots([])
      }
    } catch {
      toast.error('Failed to load availability. Please check your connection and retry.')
      setTimeSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [state.branch, state.service, state.date])

  useEffect(() => {
    if (step === 4) fetchSlots()
  }, [step, fetchSlots])

  // Poll for slot availability updates every 15 seconds while on step 4
  useEffect(() => {
    if (step !== 4) return

    const pollInterval = setInterval(fetchSlots, 15000)
    return () => clearInterval(pollInterval)
  }, [step, fetchSlots])

  const goNext = () => setStep((s) => Math.min(s + 1, 6) as Step)
  const goBack = () => setStep((s) => Math.max(s - 1, 1) as Step)

  const handleSubmit = async () => {
    if (!state.branch || !state.service || !state.date || !state.timeSlot) return
    if (!state.name.trim() || !state.lineId.trim()) {
      toast.error('Please fill in your name and LINE ID.')
      return
    }

    setSubmitting(true)
    try {
      const dateStr = formatDate(state.date)
      const endTime = calculateEndTime(state.timeSlot, state.service.duration_minutes)

      // Re-check latest slot availability right before creating the booking.
      const slotsRes = await fetch(
        `/api/slots?branch_id=${state.branch.id}&date=${dateStr}&service_id=${state.service.id}`
      )
      if (!slotsRes.ok) {
        const err = await slotsRes.json().catch(() => ({ error: 'Failed to verify latest availability' }))
        toast.error(err.error || 'Failed to verify latest availability. Please retry.')
        return
      }

      const slotsData = await slotsRes.json()
      const latestSlot = (slotsData.slots as TimeSlot[]).find((slot) => slot.time === state.timeSlot)
      if (!latestSlot?.available) {
        toast.error('That time was just taken. Please pick another slot.')
        setStep(4)
        setState((s) => ({ ...s, timeSlot: null }))
        await fetchSlots()
        return
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: state.branch.id,
          service_id: state.service.id,
          customer_name: state.name.trim(),
          line_id: state.lineId.trim(),
          phone: state.phone.trim(),
          date: dateStr,
          start_time: state.timeSlot,
          end_time: endTime,
          status: 'confirmed',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setBookingId(data.id || 'DEMO-' + Date.now())
        setState((s) => ({ ...s, lineNotificationSent: data.line_notification_sent }))

        toast.success('Booking confirmed! ✨')
        setStep(6)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Booking failed. Please try again.')
        if (res.status === 409) {
          setStep(4)
          setState((s) => ({ ...s, timeSlot: null }))
          await fetchSlots()
        }
      }
    } catch {
      toast.error('Booking failed due to a network/server issue. Please retry.')
    } finally {
      setSubmitting(false)
    }
  }

  const today = startOfToday()
  const disabledDays = [
    { before: addDays(today, 0) }, // Can't book in the past
    (date: Date) => date.getDay() === 0, // Sundays
  ]

  const stepLabels = ['Branch', 'Service', 'Date', 'Time', 'Details', 'Confirm']

  return (
    <div className="min-h-screen bg-cream pt-16">
      {/* Header */}
      <div className="bg-hero-gradient py-12 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern opacity-20" />
        <div className="relative z-10 text-center px-4">
          <p className="text-rose-light text-sm font-semibold uppercase tracking-widest mb-2">Online Booking</p>
          <h1 className="font-playfair text-4xl md:text-5xl text-white font-bold">
            Book Your <span className="italic font-light">Appointment</span>
          </h1>
        </div>
      </div>

      {/* Progress Steps */}
      {step < 6 && (
        <div className="bg-white border-b border-blush sticky top-16 z-40">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {stepLabels.slice(0, 5).map((label, i) => {
                const stepNum = (i + 1) as Step
                const isActive = step === stepNum
                const isDone = step > stepNum
                return (
                  <div key={label} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isDone
                            ? 'bg-rose text-white'
                            : isActive
                            ? 'bg-rose text-white ring-4 ring-rose/20'
                            : 'bg-blush text-warmgray'
                        }`}
                      >
                        {isDone ? <Check className="w-4 h-4" /> : stepNum}
                      </div>
                      <span
                        className={`text-xs mt-1 hidden sm:block font-medium ${
                          isActive ? 'text-rose' : isDone ? 'text-charcoal' : 'text-warmgray'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                    {i < 4 && (
                      <div
                        className={`h-0.5 w-8 sm:w-12 mx-1 sm:mx-2 transition-all ${
                          step > stepNum ? 'bg-rose' : 'bg-blush'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* ── STEP 1: Branch ── */}
        {step === 1 && (
          <div className="step-enter">
            <h2 className="font-playfair text-2xl text-charcoal font-bold mb-2">Choose a Branch</h2>
            <p className="text-warmgray text-sm mb-8">Select the location most convenient for you.</p>
            <div className="space-y-4">
              {BRANCHES.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => {
                    setState((s) => ({ ...s, branch, service: null, date: null, timeSlot: null }))
                    goNext()
                  }}
                  className={`w-full text-left p-6 rounded-2xl border-2 transition-all duration-200 hover:shadow-soft group ${
                    state.branch?.id === branch.id
                      ? 'border-rose bg-blush shadow-soft'
                      : 'border-transparent bg-white hover:border-rose-light shadow-card'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-playfair text-xl font-semibold text-charcoal group-hover:text-rose transition-colors">
                        {branch.name}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-warmgray">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose" />
                          {branch.address}
                        </span>
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-rose" />
                          {branch.staff_count} technicians
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-warmgray group-hover:text-rose group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Service ── */}
        {step === 2 && (
          <div className="step-enter">
            <button onClick={goBack} className="flex items-center gap-1 text-warmgray hover:text-rose text-sm mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="font-playfair text-2xl text-charcoal font-bold mb-2">Select a Service</h2>
            <p className="text-warmgray text-sm mb-8">
              Booking at <strong className="text-charcoal">{state.branch?.name}</strong>. What would you like today?
            </p>
            <div className="space-y-3">
              {SERVICES.map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => {
                    setState((s) => ({ ...s, service: svc, date: null, timeSlot: null }))
                    goNext()
                  }}
                  className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 hover:shadow-soft group ${
                    state.service?.id === svc.id
                      ? 'border-rose bg-blush shadow-soft'
                      : 'border-transparent bg-white hover:border-rose-light shadow-card'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-charcoal group-hover:text-rose transition-colors">
                        {svc.name}
                      </h3>
                      <p className="text-warmgray text-xs mt-1 line-clamp-1">{svc.description}</p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-rose font-bold text-lg">{formatPrice(svc.price)}</p>
                      <p className="text-warmgray text-xs flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(svc.duration_minutes)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Date ── */}
        {step === 3 && (
          <div className="step-enter">
            <button onClick={goBack} className="flex items-center gap-1 text-warmgray hover:text-rose text-sm mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="font-playfair text-2xl text-charcoal font-bold mb-2">Choose a Date</h2>
              <p className="text-warmgray text-sm mb-6">
              We&apos;re open Mon–Fri 10–20:00, Sat 10–18:00. Closed Sundays.
            </p>
            <div className="bg-white rounded-2xl shadow-card p-6 flex justify-center">
              <DayPicker
                mode="single"
                selected={state.date ?? undefined}
                onSelect={(date) => {
                  if (date && !isDateClosed(date)) {
                    setState((s) => ({ ...s, date, timeSlot: null }))
                  }
                }}
                disabled={[
                  { before: today },
                  (date: Date) => date.getDay() === 0,
                ]}
                fromDate={today}
                toDate={addDays(today, 60)}
                showOutsideDays
              />
            </div>
            {state.date && (
              <div className="mt-4 p-4 bg-blush rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-warmgray">Selected Date</p>
                  <p className="font-semibold text-charcoal">{formatDisplayDate(formatDate(state.date))}</p>
                </div>
                <button
                  onClick={goNext}
                  className="bg-rose text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-rose-dark transition-colors"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 4: Time Slot ── */}
        {step === 4 && (
          <div className="step-enter">
            <button onClick={goBack} className="flex items-center gap-1 text-warmgray hover:text-rose text-sm mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="font-playfair text-2xl text-charcoal font-bold mb-2">Select a Time</h2>
            <p className="text-warmgray text-sm mb-6">
              {state.date && formatDisplayDate(formatDate(state.date))} · {state.service?.name} ({formatDuration(state.service?.duration_minutes || 60)})
            </p>

            {loadingSlots ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-rose animate-spin" />
                <span className="ml-3 text-warmgray">Checking availability...</span>
              </div>
            ) : timeSlots.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl shadow-card">
                <p className="text-4xl mb-4">😔</p>
                <p className="font-playfair text-xl text-charcoal font-semibold mb-2">No slots available</p>
                <p className="text-warmgray text-sm">Please try a different date.</p>
                <button
                  onClick={goBack}
                  className="mt-6 bg-rose text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-rose-dark transition-colors"
                >
                  Choose Another Date
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-4 text-xs mb-4 flex-wrap justify-between items-center">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-rose" />
                      <span className="text-warmgray">Selected</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-blush border border-rose-light" />
                      <span className="text-warmgray">Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-gray-200" />
                      <span className="text-warmgray">Booked</span>
                    </div>
                  </div>
                  {slotCheckTime && (
                    <div className="text-warmgray text-xs">
                      ✓ Updated: {slotCheckTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                <div className="slot-grid">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      disabled={!slot.available}
                      onClick={() => {
                        if (slot.available) {
                          setState((s) => ({ ...s, timeSlot: slot.time }))
                        } else {
                          toast.error('This slot just became unavailable. Please select another time.')
                          setState((s) => ({ ...s, timeSlot: null }))
                        }
                      }}
                      className={`py-3 px-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                        !slot.available
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                          : state.timeSlot === slot.time
                          ? 'bg-rose text-white shadow-soft scale-105'
                          : 'bg-white text-charcoal border-2 border-rose-light hover:border-rose hover:bg-blush shadow-card'
                      }`}
                    >
                      {slot.time}
                      {!slot.available && (
                        <div className="text-xs font-normal mt-0.5 no-underline">Full</div>
                      )}
                    </button>
                  ))}
                </div>

                {state.timeSlot && (
                  <div className="mt-6 p-4 bg-blush rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-warmgray">Selected Time</p>
                      <p className="font-bold text-charcoal text-lg">{state.timeSlot}</p>
                      <p className="text-xs text-warmgray">
                        Ends at {calculateEndTime(state.timeSlot, state.service?.duration_minutes || 60)}
                      </p>
                    </div>
                    <button
                      onClick={goNext}
                      className="bg-rose text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-rose-dark transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STEP 5: Customer Details ── */}
        {step === 5 && (
          <div className="step-enter">
            <button onClick={goBack} className="flex items-center gap-1 text-warmgray hover:text-rose text-sm mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="font-playfair text-2xl text-charcoal font-bold mb-2">Your Details</h2>
            <p className="text-warmgray text-sm mb-8">Just a few details to confirm your booking.</p>

            {/* Summary */}
            <div className="bg-blush rounded-2xl p-5 mb-7 grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Branch', value: state.branch?.name },
                { label: 'Service', value: state.service?.name },
                { label: 'Date', value: state.date ? format(state.date, 'EEE, MMM d') : '' },
                { label: 'Time', value: state.timeSlot },
                { label: 'Duration', value: formatDuration(state.service?.duration_minutes || 0) },
                { label: 'Price', value: formatPrice(state.service?.price || 0) },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-warmgray text-xs">{item.label}</p>
                  <p className="font-semibold text-charcoal">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Form */}
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-2">
                  <User className="w-4 h-4 inline mr-1 text-rose" />
                  Full Name <span className="text-rose">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={state.name}
                  onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-blush bg-white text-charcoal placeholder-warmgray/50 focus:outline-none focus:border-rose transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal mb-2">
                  <MessageCircle className="w-4 h-4 inline mr-1 text-rose" />
                  LINE ID <span className="text-rose">*</span>
                </label>
                {state.lineId ? (
                  <div className="w-full px-4 py-3 rounded-xl border-2 border-blush bg-gray-50 text-charcoal font-semibold">
                    Connected to your LINE account ✓
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Your LINE ID (e.g., 20070928m)"
                    value={state.lineId}
                    onChange={(e) => setState((s) => ({ ...s, lineId: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border-2 border-blush bg-white text-charcoal placeholder-warmgray/50 focus:outline-none focus:border-rose transition-colors"
                  />
                )}
                <p className="text-xs text-warmgray mt-1.5">
                  {state.lineId ? 'Your confirmation will be sent to LINE.' : 'We need your LINE ID to send confirmation.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal mb-2">
                  <Phone className="w-4 h-4 inline mr-1 text-rose" />
                  Phone Number <span className="text-warmgray font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  placeholder="09XX-XXX-XXX"
                  value={state.phone}
                  onChange={(e) => setState((s) => ({ ...s, phone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-blush bg-white text-charcoal placeholder-warmgray/50 focus:outline-none focus:border-rose transition-colors"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !state.name.trim() || !state.lineId.trim()}
                className="w-full bg-rose text-white py-4 rounded-xl font-bold text-base hover:bg-rose-dark transition-colors shadow-soft disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Confirm Booking
                  </>
                )}
              </button>

              <p className="text-center text-xs text-warmgray">
                By booking, you agree to our cancellation policy. Free cancellation before your appointment.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 6: Confirmation ── */}
        {step === 6 && (
          <div className="step-enter text-center">
            <div className="bg-white rounded-3xl shadow-medium p-10 md:p-14">
              {/* Success icon */}
              <div className="w-20 h-20 bg-rose/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-14 h-14 bg-rose rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-white" />
                </div>
              </div>

              <h2 className="font-playfair text-3xl text-charcoal font-bold mb-2">
                Booking Confirmed! 🎉
              </h2>
              <p className="text-warmgray mb-2">
                Your appointment has been booked successfully.
              </p>
              {bookingId && (
                <p className="text-xs text-warmgray mb-8">
                  Booking reference: <span className="font-mono font-bold text-rose">{bookingId}</span>
                </p>
              )}

              {/* Booking Details */}
              <div className="bg-blush rounded-2xl p-6 text-left mb-8">
                <h3 className="font-playfair text-lg font-semibold text-charcoal mb-4">Appointment Details</h3>
                <div className="space-y-3">
                  {[
                    { label: '💅 Service', value: state.service?.name },
                    { label: '📍 Branch', value: state.branch?.name },
                    { label: '📅 Date', value: state.date ? formatDisplayDate(formatDate(state.date)) : '' },
                    { label: '⏰ Time', value: `${state.timeSlot} – ${calculateEndTime(state.timeSlot!, state.service?.duration_minutes || 0)}` },
                    { label: '💰 Price', value: formatPrice(state.service?.price || 0) },
                    { label: '👤 Name', value: state.name },
                    { label: '💬 LINE', value: state.lineId },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4 text-sm">
                      <span className="text-warmgray flex-shrink-0">{item.label}</span>
                      <span className="font-semibold text-charcoal text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`border rounded-xl p-4 text-sm mb-8 ${
                state.lineNotificationSent
                  ? 'bg-rose/5 border-rose/20'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                {state.lineNotificationSent ? (
                  <p>📱 Confirmation message sent to your LINE account.</p>
                ) : (
                  <p>⚠️ LINE confirmation could not be sent. Please contact support or call us to confirm.</p>
                )}
                <p className="mt-1">Please arrive 5 minutes before your appointment time.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setState({
                      branch: null, service: null, date: null,
                      timeSlot: null, name: '', lineId: '', phone: '',
                    })
                    setBookingId(null)
                    setStep(1)
                  }}
                  className="flex-1 bg-blush text-rose py-3.5 rounded-xl font-semibold hover:bg-rose-light transition-colors"
                >
                  Book Another Appointment
                </button>
                <a
                  href="/"
                  className="flex-1 bg-charcoal text-white py-3.5 rounded-xl font-semibold hover:bg-charcoal/80 transition-colors text-center"
                >
                  Return Home
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-rose animate-spin" />
      </div>
    }>
      <BookingContent />
    </Suspense>
  )
}
