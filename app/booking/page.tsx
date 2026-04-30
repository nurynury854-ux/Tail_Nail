'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DayPicker } from 'react-day-picker'
import { addDays, format, startOfToday } from 'date-fns'
import toast from 'react-hot-toast'
import { ChevronLeft, Check, Loader2 } from 'lucide-react'
import { BRANCHES, SERVICES, Branch, SelectedServiceItem, Service, Stylist, TimeSlot } from '@/lib/types'
import { calculateEndTime, formatDate, formatDisplayDate, isValidTaiwanMobile } from '@/lib/bookingUtils'

import 'react-day-picker/dist/style.css'

type Step = 1 | 2 | 3 | 4 | 5 | 6

type BookingState = {
  branch: Branch | null
  category: 'hand' | 'foot'
  mainServiceId: string | null
  addonServiceIds: string[]
  stylist: Stylist | null
  noPreference: boolean
  date: Date | null
  timeSlot: string | null
  name: string
  phone: string
  lineId: string
  note: string
  assignedStylistName?: string
  bookingId?: string
}

function BookingContent() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>(1)
  const [branches, setBranches] = useState<Branch[]>(BRANCHES)
  const [services, setServices] = useState<Service[]>(SERVICES)
  const [stylists, setStylists] = useState<Stylist[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [stylistDurations, setStylistDurations] = useState<Record<string, number>>({})
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loadingStylists, setLoadingStylists] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [state, setState] = useState<BookingState>({
    branch: null,
    category: 'hand',
    mainServiceId: null,
    addonServiceIds: [],
    stylist: null,
    noPreference: true,
    date: null,
    timeSlot: null,
    name: '',
    phone: '',
    lineId: '',
    note: '',
  })

  const goNext = () => setStep((s) => Math.min(6, s + 1) as Step)
  const goBack = () => {
    setStep((s) => {
      const prev = Math.max(1, s - 1) as Step
      if (prev <= 2) setStylistDurations({})
      return prev
    })
  }

  useEffect(() => {
    // Keep each step transition anchored at page top instead of preserving prior scroll.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  useEffect(() => {
    const userId = searchParams.get('userId')
    if (userId) {
      setState((prev) => ({ ...prev, lineId: userId }))
    }
  }, [searchParams])

  useEffect(() => {
    const loadMaster = async () => {
      try {
        const [branchRes, serviceRes] = await Promise.all([fetch('/api/branches'), fetch('/api/services')])
        if (branchRes.ok) {
          const data = (await branchRes.json()) as Branch[]
          if (Array.isArray(data) && data.length > 0) setBranches(data)
        }
        if (serviceRes.ok) {
          const data = (await serviceRes.json()) as Service[]
          if (Array.isArray(data) && data.length > 0) setServices(data)
        }
      } catch {
        toast.error('讀取分店與服務資料失敗，已使用預設備援資料')
      }
    }

    loadMaster()
  }, [])

  const mainServices = useMemo(() => services.filter((s) => s.service_type === 'main' && s.is_active), [services])
  const addonServices = useMemo(() => services.filter((s) => s.service_type === 'addon' && s.is_active), [services])

  const selectedMain = useMemo(
    () => (state.mainServiceId ? services.find((s) => s.id === state.mainServiceId) || null : null),
    [state.mainServiceId, services]
  )

  const selectedAddons = useMemo(
    () => services.filter((s) => state.addonServiceIds.includes(s.id)),
    [services, state.addonServiceIds]
  )

  const selectedServices = useMemo<SelectedServiceItem[]>(() => {
    const result: SelectedServiceItem[] = []
    if (selectedMain) {
      const dur = stylistDurations[selectedMain.id] ?? selectedMain.duration_minutes ?? null
      result.push({
        service_id: selectedMain.id,
        service_name: selectedMain.name,
        service_type: 'main',
        category: state.category,
        duration_minutes: dur ?? 0,
        is_pending: dur === null,
      })
    }

    for (const addon of selectedAddons) {
      const dur = stylistDurations[addon.id] ?? addon.duration_minutes ?? null
      result.push({
        service_id: addon.id,
        service_name: addon.name,
        service_type: 'addon',
        category: state.category,
        duration_minutes: dur ?? 0,
        is_pending: dur === null,
      })
    }

    return result
  }, [selectedMain, selectedAddons, state.category, stylistDurations])

  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, item) => sum + item.duration_minutes, 0),
    [selectedServices]
  )

  const selectedServicesLabel = useMemo(() => {
    if (selectedServices.length === 0) return '尚未選擇服務'
    return selectedServices.map((s) => s.service_name || s.service_id).join(' + ')
  }, [selectedServices])

  const fetchStylistDurations = useCallback(async (
    stylistId: string | null,
    branchId: string,
    category: 'hand' | 'foot'
  ) => {
    const params = new URLSearchParams({ category })
    if (stylistId) params.set('stylist_id', stylistId)
    else params.set('branch_id', branchId)
    try {
      const res = await fetch(`/api/service-durations?${params}`)
      if (!res.ok) return
      const durations = await res.json()
      // If a specific stylist has no duration records, fall back to branch max
      // so that slot availability is always calculated conservatively
      if (stylistId && Object.keys(durations).length === 0) {
        const fallback = await fetch(`/api/service-durations?branch_id=${branchId}&category=${category}`)
        setStylistDurations(fallback.ok ? await fallback.json() : {})
      } else {
        setStylistDurations(durations)
      }
    } catch { /* non-fatal */ }
  }, [])

  const fetchStylists = useCallback(async (branchId: string) => {
    setLoadingStylists(true)
    try {
      const res = await fetch(`/api/stylists?branch_id=${branchId}&active=true`)
      if (!res.ok) {
        setStylists([])
        toast.error('讀取美甲師資料失敗')
        return
      }
      const data = (await res.json()) as Stylist[]
      setStylists(Array.isArray(data) ? data : [])
    } catch {
      toast.error('讀取美甲師資料失敗')
      setStylists([])
    } finally {
      setLoadingStylists(false)
    }
  }, [])

  useEffect(() => {
    if (!state.branch) return
    fetchStylists(state.branch.id)
  }, [state.branch, fetchStylists])

  const fetchSlots = useCallback(async () => {
    if (!state.branch || !state.date || totalDuration <= 0) return

    setLoadingSlots(true)
    try {
      const params = new URLSearchParams({
        branch_id: state.branch.id,
        date: formatDate(state.date),
        total_duration: String(totalDuration),
      })

      if (!state.noPreference && state.stylist) {
        params.set('stylist_id', state.stylist.id)
      }

      const res = await fetch(`/api/slots?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '讀取可預約時段失敗' }))
        toast.error(err.error || '讀取可預約時段失敗')
        setTimeSlots([])
        return
      }

      const data = await res.json()
      setTimeSlots(Array.isArray(data.slots) ? data.slots : [])
    } catch {
      setTimeSlots([])
      toast.error('讀取可預約時段失敗')
    } finally {
      setLoadingSlots(false)
    }
  }, [state.branch, state.date, state.noPreference, state.stylist, totalDuration])

  useEffect(() => {
    if (step === 4) {
      fetchSlots()
    }
  }, [step, fetchSlots])

  useEffect(() => {
    if (step !== 4 || !state.branch) return
    void fetchStylistDurations(
      state.noPreference ? null : state.stylist?.id ?? null,
      state.branch.id,
      state.category
    )
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const submitBooking = async () => {
    if (!state.branch || !state.date || !state.timeSlot) return

    if (!state.name.trim()) {
      toast.error('請填寫姓名')
      return
    }

    if (!isValidTaiwanMobile(state.phone.trim())) {
      toast.error('手機格式需為 09xxxxxxxx')
      return
    }

    if (selectedServices.length === 0) {
      toast.error('請先選擇至少一項服務')
      return
    }

    setSubmitting(true)

    try {
      const date = formatDate(state.date)
      const recheck = await fetch(`/api/slots?${new URLSearchParams({
        branch_id: state.branch.id,
        date,
        total_duration: String(totalDuration),
        ...(state.noPreference || !state.stylist ? {} : { stylist_id: state.stylist.id }),
      }).toString()}`, { cache: 'no-store' })

      if (!recheck.ok) {
        toast.error('重新檢查時段失敗，請稍後再試')
        return
      }

      const latest = await recheck.json()
      const slot = (latest.slots as TimeSlot[]).find((s) => s.time === state.timeSlot)
      if (!slot?.available) {
        toast.error('此時段剛被預約，請重新選擇')
        setState((prev) => ({ ...prev, timeSlot: null }))
        await fetchSlots()
        return
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: state.branch.id,
          stylist_id: state.noPreference ? null : state.stylist?.id || null,
          customer_name: state.name.trim(),
          line_id: state.lineId.trim(),
          phone: state.phone.trim(),
          selected_services: selectedServices,
          category: state.category,
          total_duration: totalDuration,
          date,
          start_time: state.timeSlot,
          end_time: calculateEndTime(state.timeSlot, totalDuration),
          status: 'confirmed',
          note: state.note.trim() || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '預約失敗，請稍後再試' }))
        toast.error(err.error || '預約失敗，請稍後再試')
        return
      }

      const result = await res.json()
      setState((prev) => ({
        ...prev,
        assignedStylistName: result.assigned_stylist_name || prev.stylist?.name || '不指定',
        bookingId: result.id,
      }))
      setStep(6)
      toast.success('預約成功')
    } catch {
      toast.error('預約失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen pt-16 pb-16 relative">
<div className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
        <div className="relative">
          <img
            src="/images/cat_navbar_2x.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none select-none absolute z-0 left-[77%] sm:left-[79%] -translate-x-1/2 top-[17px] sm:-top-[7px] w-[180px] sm:w-[235px]"
          />

          <div className="relative z-20 text-center mb-8 sm:mb-10">
            <div className="intro-ribbon mb-4 justify-center"><span /></div>
            <h1 className="font-playfair text-4xl sm:text-5xl text-charcoal font-normal tracking-wide">線上預約</h1>
            <p className="text-warmgray mt-3 tracking-[0.22em] text-sm sm:text-base">Ttail Nail</p>
          </div>

          {step < 6 && (
            <div className="relative z-10 mt-6 max-w-3xl mx-auto">
              <div className="pt-9 sm:pt-10 grid grid-cols-5 gap-2 sm:gap-3">
                {['分店', '服務', '美甲師', '時間', '資料'].map((label, index) => {
                  const current = index + 1
                  return (
                    <div key={label} className="text-center">
                      <div className={`h-10 rounded-full text-sm font-semibold flex items-center justify-center shadow-md transition-all duration-200 ${step >= current ? 'bg-rose text-white shadow-rose/30' : 'bg-white/85 text-warmgray border border-[#DDD5C8]'}`}>
                        {step > current ? <Check className="w-4 h-4" /> : current}
                      </div>
                      <p className="text-xs mt-1 text-warmgray">{label}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-3xl p-8 sm:p-10 mt-8 bg-blush/40 backdrop-blur-md">
          {step === 1 && (
            <div>
              <p className="section-kicker mb-2">Select a branch</p>
              <h2 className="section-title text-2xl sm:text-3xl tracking-tight">1. 選擇分店</h2>
              <div className="space-y-4 mt-6">
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => {
                      setState((prev) => ({ ...prev, branch, stylist: null, noPreference: true, date: null, timeSlot: null }))
                      goNext()
                    }}
                    className="w-full text-left border border-[#DDD5C8] bg-[#FAF7F2] rounded-2xl p-5 hover:border-rose transition-all duration-200 shadow-md hover:shadow-xl hover:-translate-y-1"
                  >
                    <p className="font-semibold text-charcoal">{branch.name}</p>
                    <p className="text-sm text-warmgray mt-1">{branch.address}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <button onClick={goBack} className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> 返回
              </button>
              <p className="section-kicker mt-4 mb-2">Choose services</p>
              <h2 className="section-title text-2xl sm:text-3xl tracking-tight">2. 選擇服務項目</h2>

              <div className="mt-5 inline-flex p-1 rounded-full bg-white/70 border border-[#DDD5C8] shadow-sm">
                <button
                  onClick={() => setState((prev) => ({ ...prev, category: 'hand' }))}
                  className={`px-5 py-2.5 rounded-full text-sm ${state.category === 'hand' ? 'bg-rose text-white' : 'text-charcoal'}`}
                >
                  手部
                </button>
                <button
                  onClick={() => setState((prev) => ({ ...prev, category: 'foot' }))}
                  className={`px-5 py-2.5 rounded-full text-sm ${state.category === 'foot' ? 'bg-rose text-white' : 'text-charcoal'}`}
                >
                  足部
                </button>
              </div>

              <h3 className="section-title text-lg mt-6 mb-2">主項目（單選）</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {mainServices.map((service) => {
                  const active = state.mainServiceId === service.id
                  return (
                    <button
                      key={service.id}
                      onClick={() => setState((prev) => ({ ...prev, mainServiceId: service.id, timeSlot: null }))}
                      className={`border-2 rounded-2xl p-4 sm:p-5 text-left transition-all duration-200 relative ${active ? 'border-rose bg-rose/10 text-charcoal shadow-lg -translate-y-0.5' : 'border-[#DDD5C8] bg-[#FAF7F2] text-charcoal hover:border-rose/60 hover:shadow-md hover:-translate-y-0.5'}`}
                    >
                      <p className="font-medium">{service.name}</p>
                      {active && <span className="absolute top-3 right-3 text-rose text-base leading-none font-bold">✓</span>}
                    </button>
                  )
                })}
              </div>

              <h3 className="section-title text-lg mt-6 mb-2">附加項目（可複選，也可單獨預約）</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {addonServices.map((service) => {
                  const checked = state.addonServiceIds.includes(service.id)
                  return (
                    <label key={service.id} className={`border-2 rounded-2xl p-4 sm:p-5 flex items-center gap-3 cursor-pointer transition-all duration-200 ${checked ? 'border-rose bg-rose/10 text-charcoal shadow-lg -translate-y-0.5' : 'border-[#DDD5C8] bg-[#FAF7F2] text-charcoal hover:border-rose/60 hover:shadow-md hover:-translate-y-0.5'}`}>
                      <span className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${checked ? 'bg-rose border-rose text-white' : 'border-[#C0B4A8] bg-white'}`}>
                        {checked && '✓'}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setState((prev) => ({
                            ...prev,
                            addonServiceIds: e.target.checked
                              ? [...prev.addonServiceIds, service.id]
                              : prev.addonServiceIds.filter((id) => id !== service.id),
                            timeSlot: null,
                          }))
                        }}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{service.name}</span>
                    </label>
                  )
                })}
              </div>

              <div className="mt-6 p-5 rounded-2xl bg-white/80 border border-[#DDD5C8] text-sm shadow-md">
                <p className="text-charcoal">已選服務：{selectedServicesLabel}</p>
                <p className="text-warmgray mt-1">
                  預估總時間：{Object.keys(stylistDurations).length > 0 ? `${totalDuration} 分鐘` : '依美甲師而定'}
                </p>
              </div>

              <button
                onClick={() => {
                  if (selectedServices.length === 0) {
                    toast.error('請先選擇至少一項服務')
                    return
                  }
                  goNext()
                }}
                className="btn-primary mt-5 bg-rose text-white px-6 py-3 rounded-full text-sm font-semibold"
              >
                下一步
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <button onClick={goBack} className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> 返回
              </button>
              <p className="section-kicker mt-4 mb-2">Choose stylist</p>
              <h2 className="section-title text-2xl sm:text-3xl tracking-tight">3. 選擇美甲師</h2>

              <button
                onClick={() => {
                  setState((prev) => ({ ...prev, noPreference: true, stylist: null, date: null, timeSlot: null }))
                  goNext()
                }}
                className={`mt-4 w-full text-left border rounded-2xl p-5 transition-all duration-200 ${state.noPreference ? 'border-rose bg-white shadow-lg -translate-y-0.5' : 'border-[#DDD5C8] bg-[#FAF7F2] hover:shadow-md hover:-translate-y-0.5'}`}
              >
                <p className="font-medium text-charcoal">不指定（系統自動分配）</p>
              </button>

              {loadingStylists ? (
                <p className="text-sm text-warmgray mt-4 inline-flex items-center">
                  <Loader2 className="w-4 h-4 animate-spin mr-1" /> 讀取中...
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2 mt-3">
                  {stylists.map((stylist) => (
                    <button
                      key={stylist.id}
                      onClick={() => {
                        setState((prev) => ({ ...prev, noPreference: false, stylist, date: null, timeSlot: null }))
                        goNext()
                      }}
                      className="border border-blush rounded-2xl p-4 text-left hover:border-rose shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <p className="font-medium text-charcoal">{stylist.name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <button onClick={goBack} className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> 返回
              </button>
              <p className="section-kicker mt-4 mb-2">Choose time</p>
              <h2 className="section-title text-2xl sm:text-3xl tracking-tight">4. 選擇日期與時間</h2>

              <div className="mt-4 bg-[#FAF7F2] border border-[#DDD5C8] rounded-2xl p-5 sm:p-6 shadow-md">
                <DayPicker
                  mode="single"
                  selected={state.date || undefined}
                  onSelect={(date) => setState((prev) => ({ ...prev, date: date || null, timeSlot: null }))}
                  disabled={{ before: startOfToday() }}
                  fromDate={startOfToday()}
                  toDate={addDays(startOfToday(), 60)}
                />
              </div>

              {state.date && (
                <div className="mt-4">
                  {loadingSlots ? (
                    <p className="text-sm text-warmgray inline-flex items-center">
                      <Loader2 className="w-4 h-4 animate-spin mr-1" /> 讀取時段中...
                    </p>
                  ) : timeSlots.length === 0 ? (
                    <p className="text-sm text-warmgray py-4 text-center">此日無可預約時段，請選擇其他日期。</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {timeSlots.map((slot) => (
                        <button
                          key={slot.time}
                          disabled={!slot.available}
                          onClick={() => setState((prev) => ({ ...prev, timeSlot: slot.time }))}
                          className={`py-2.5 rounded-xl text-sm border shadow-sm transition-all duration-150 ${
                            !slot.available
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                              : state.timeSlot === slot.time
                              ? 'bg-rose text-white border-rose shadow-md'
                              : 'bg-white text-charcoal border-blush hover:border-rose hover:shadow-md hover:-translate-y-0.5'
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => {
                  if (!state.date || !state.timeSlot) {
                    toast.error('請先選擇日期與時間')
                    return
                  }
                  goNext()
                }}
                className="btn-primary mt-5 bg-rose text-white px-6 py-3 rounded-full text-sm font-semibold"
              >
                下一步
              </button>
            </div>
          )}

          {step === 5 && (
            <div>
              <button onClick={goBack} className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> 返回
              </button>
              <p className="section-kicker mt-4 mb-2">Details & confirm</p>
              <h2 className="section-title text-2xl sm:text-3xl tracking-tight">5. 填寫資料與確認</h2>

              <div className="space-y-4 mt-5">
                <input
                  className="w-full border border-blush rounded-xl px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-rose/30 focus:border-rose transition-all"
                  placeholder="姓名（必填）"
                  value={state.name}
                  onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
                />
                <input
                  className="w-full border border-blush rounded-xl px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-rose/30 focus:border-rose transition-all"
                  placeholder="手機（09xxxxxxxx）"
                  value={state.phone}
                  onChange={(e) => setState((prev) => ({ ...prev, phone: e.target.value }))}
                />
                <input
                  className="w-full border border-blush rounded-xl px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-rose/30 focus:border-rose transition-all"
                  placeholder="LINE ID（選填）"
                  value={state.lineId}
                  onChange={(e) => setState((prev) => ({ ...prev, lineId: e.target.value }))}
                />
                <textarea
                  className="w-full border border-blush rounded-xl px-4 py-2.5 text-sm shadow-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-rose/30 focus:border-rose transition-all"
                  placeholder="特殊需求備註（選填）"
                  value={state.note}
                  onChange={(e) => setState((prev) => ({ ...prev, note: e.target.value }))}
                />
              </div>

              <div className="mt-6 p-5 rounded-2xl bg-white/80 border border-[#DDD5C8] text-sm shadow-md space-y-1">
                <p>分店：{state.branch?.name}</p>
                <p>服務：{selectedServicesLabel}</p>
                <p>美甲師：{state.noPreference ? '不指定' : state.stylist?.name}</p>
                <p>日期：{state.date ? formatDisplayDate(formatDate(state.date)) : '-'}</p>
                <p>
                  時間：{state.timeSlot} - {state.timeSlot ? calculateEndTime(state.timeSlot, totalDuration) : '-'}
                </p>
                <p>總時長：{totalDuration} 分鐘</p>
              </div>

              <button
                onClick={submitBooking}
                disabled={submitting}
                className="btn-primary mt-5 bg-rose text-white px-6 py-3 rounded-full text-sm font-semibold disabled:opacity-60 inline-flex items-center"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                送出預約
              </button>
            </div>
          )}

          {step === 6 && (
            <div>
              <h2 className="text-2xl font-semibold text-charcoal">預約完成</h2>
              <p className="text-warmgray mt-2">謝謝您的預約，我們已收到您的資料。</p>
              <div className="mt-4 text-sm bg-white/80 border border-[#DDD5C8] rounded-2xl p-5 space-y-1 shadow-md">
                <p>預約編號：{state.bookingId || '-'}</p>
                <p>分店：{state.branch?.name}</p>
                <p>服務：{selectedServicesLabel}</p>
                <p>美甲師：{state.assignedStylistName || (state.noPreference ? '不指定' : state.stylist?.name || '-')}</p>
                <p>日期：{state.date ? format(state.date, 'yyyy-MM-dd') : '-'}</p>
                <p>
                  時間：{state.timeSlot} - {state.timeSlot ? calculateEndTime(state.timeSlot, totalDuration) : '-'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-24 text-center text-warmgray">載入中...</div>}>
      <BookingContent />
    </Suspense>
  )
}
