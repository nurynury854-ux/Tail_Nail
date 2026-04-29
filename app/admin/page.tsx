'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search,
  Plus,
  X,
  RefreshCw,
  Loader2,
  ChevronDown,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Sparkles,
  Phone,
  MessageCircle,
  Building2,
  Scissors,
  Settings,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Booking, BRANCHES, SERVICES, Branch, Service, Stylist } from '@/lib/types'
import { formatPrice, formatDuration, calculateEndTime } from '@/lib/bookingUtils'

type FilterState = {
  branch_id: string
  date: string
  status: string
  search: string
}

type ManualBooking = {
  branch_id: string
  service_id: string
  stylist_id: string
  date: string
  start_time: string
  customer_name: string
  line_id: string
  phone: string
}

type BranchForm = {
  name: string
  address: string
  staff_count: string
  phone: string
}

type StylistForm = {
  branch_id: string
  name: string
  bio: string
}

type WeeklyForm = {
  dayKey: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  dayOfWeek: number
  startTime: string
  endTime: string
  isWorking: boolean
}

type OverrideForm = {
  date: string
  startTime: string
  endTime: string
  isOffOrClosed: boolean
  reason: string
}

type SchedulePayload = {
  branchHours: Record<string, string | null> | null
  stylistWeekly: Array<{
    id: string
    day_of_week: number
    start_time?: string | null
    end_time?: string | null
    is_working: boolean
  }>
  branchOverrides: Array<{
    id: string
    date: string
    open_time?: string | null
    close_time?: string | null
    is_closed: boolean
    reason?: string | null
  }>
  stylistOverrides: Array<{
    id: string
    date: string
    start_time?: string | null
    end_time?: string | null
    is_off: boolean
    reason?: string | null
  }>
}

const DAY_OPTIONS = [
  { key: 'sunday', label: '週日', value: 0 },
  { key: 'monday', label: '週一', value: 1 },
  { key: 'tuesday', label: '週二', value: 2 },
  { key: 'wednesday', label: '週三', value: 3 },
  { key: 'thursday', label: '週四', value: 4 },
  { key: 'friday', label: '週五', value: 5 },
  { key: 'saturday', label: '週六', value: 6 },
] as const

const STATUS_LABEL: Record<string, string> = {
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消',
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
    completed: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return map[status] || 'bg-blush text-rose border-rose-light'
}

export default function AdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterState>({ branch_id: '', date: '', status: '', search: '' })
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState<ManualBooking>({
    branch_id: '',
    service_id: '',
    stylist_id: '',
    date: '',
    start_time: '',
    customer_name: '',
    line_id: '',
    phone: '',
  })
  const [addLoading, setAddLoading] = useState(false)

  const [branches, setBranches] = useState<Branch[]>(BRANCHES)
  const [services, setServices] = useState<Service[]>(SERVICES)
  const [stylists, setStylists] = useState<Stylist[]>([])

  const [branchForm, setBranchForm] = useState<BranchForm>({ name: '', address: '', staff_count: '2', phone: '' })
  const [stylistForm, setStylistForm] = useState<StylistForm>({ branch_id: '', name: '', bio: '' })

  const [scheduleTarget, setScheduleTarget] = useState<'branch' | 'stylist'>('branch')
  const [scheduleBranchId, setScheduleBranchId] = useState('')
  const [scheduleStylistId, setScheduleStylistId] = useState('')
  const [weeklyForm, setWeeklyForm] = useState<WeeklyForm>({
    dayKey: 'monday',
    dayOfWeek: 1,
    startTime: '11:00',
    endTime: '21:00',
    isWorking: true,
  })
  const [overrideForm, setOverrideForm] = useState<OverrideForm>({
    date: '',
    startTime: '11:00',
    endTime: '21:00',
    isOffOrClosed: false,
    reason: '',
  })
  const [scheduleData, setScheduleData] = useState<SchedulePayload>({
    branchHours: null,
    stylistWeekly: [],
    branchOverrides: [],
    stylistOverrides: [],
  })
  const [allOverrides, setAllOverrides] = useState<{
    branchOverrides: SchedulePayload['branchOverrides']
    stylistOverrides: SchedulePayload['stylistOverrides']
  }>({ branchOverrides: [], stylistOverrides: [] })

  const fetchMasterData = useCallback(async () => {
    try {
      const [branchRes, serviceRes, stylistRes] = await Promise.all([
        fetch('/api/branches'),
        fetch('/api/services'),
        fetch('/api/stylists?active=false'),
      ])

      if (branchRes.ok) {
        const branchData = (await branchRes.json()) as Branch[]
        if (Array.isArray(branchData) && branchData.length > 0) {
          setBranches(branchData)
        }
      }

      if (serviceRes.ok) {
        const serviceData = (await serviceRes.json()) as Service[]
        if (Array.isArray(serviceData) && serviceData.length > 0) {
          setServices(serviceData)
        }
      }

      if (stylistRes.ok) {
        const stylistData = (await stylistRes.json()) as Stylist[]
        setStylists(Array.isArray(stylistData) ? stylistData : [])
      }
    } catch {
      toast.error('載入管理資料失敗')
    }
  }, [])

  const fetchAllOverrides = useCallback(async () => {
    try {
      const res = await fetch('/api/schedules')
      if (!res.ok) return
      const data = (await res.json()) as SchedulePayload
      setAllOverrides({ branchOverrides: data.branchOverrides, stylistOverrides: data.stylistOverrides })
    } catch { /* non-fatal */ }
  }, [])

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.branch_id) params.set('branch_id', filters.branch_id)
      if (filters.date) params.set('date', filters.date)
      if (filters.status) params.set('status', filters.status)
      const res = await fetch(`/api/bookings?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setBookings(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('載入預約失敗')
    } finally {
      setLoading(false)
    }
  }, [filters.branch_id, filters.date, filters.status])

  const fetchSchedules = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (scheduleTarget === 'branch' && scheduleBranchId) params.set('branch_id', scheduleBranchId)
      if (scheduleTarget === 'stylist' && scheduleStylistId) params.set('stylist_id', scheduleStylistId)

      const res = await fetch(`/api/schedules?${params.toString()}`)
      if (!res.ok) return
      const data = (await res.json()) as SchedulePayload
      setScheduleData(data)
    } catch {
      toast.error('載入排班失敗')
    }
  }, [scheduleTarget, scheduleBranchId, scheduleStylistId])

  useEffect(() => {
    fetchMasterData()
    fetchAllOverrides()
  }, [fetchMasterData, fetchAllOverrides])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  useEffect(() => {
    if ((scheduleTarget === 'branch' && scheduleBranchId) || (scheduleTarget === 'stylist' && scheduleStylistId)) {
      fetchSchedules()
    }
  }, [scheduleTarget, scheduleBranchId, scheduleStylistId, fetchSchedules])

  const handleCancel = async (id: string) => {
    if (!confirm('確定取消此預約？')) return
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (res.ok) {
        toast.success('預約已取消')
        fetchBookings()
      }
    } catch {
      toast.error('取消預約失敗')
    }
  }

  const handleComplete = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (res.ok) {
        toast.success('已標記為完成')
        fetchBookings()
      }
    } catch {
      toast.error('更新預約失敗')
    }
  }

  const handleAddBooking = async () => {
    const { branch_id, service_id, date, start_time, customer_name, line_id } = addForm
    if (!branch_id || !service_id || !date || !start_time || !customer_name || !line_id) {
      toast.error('請填寫必填的預約欄位')
      return
    }

    const service = services.find((s) => s.id === service_id)
    if (!service) {
      toast.error('所選服務無效')
      return
    }

    setAddLoading(true)
    try {
      const end_time = calculateEndTime(start_time, service.duration_minutes || 120)
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          stylist_id: addForm.stylist_id || null,
          end_time,
          status: 'confirmed',
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '新增預約失敗' }))
        toast.error(err.error || '新增預約失敗')
        return
      }

      toast.success('預約新增成功')
      setShowAddModal(false)
      setAddForm({
        branch_id: '',
        service_id: '',
        stylist_id: '',
        date: '',
        start_time: '',
        customer_name: '',
        line_id: '',
        phone: '',
      })
      fetchBookings()
    } catch {
      toast.error('新增預約時發生錯誤')
    } finally {
      setAddLoading(false)
    }
  }

  const handleAddBranch = async () => {
    if (!branchForm.name.trim() || !branchForm.address.trim()) {
      toast.error('分店名稱與地址為必填')
      return
    }

    const res = await fetch('/api/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: branchForm.name,
        address: branchForm.address,
        staff_count: Number(branchForm.staff_count || 2),
        phone: branchForm.phone,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '新增分店失敗' }))
      toast.error(err.error || '新增分店失敗')
      return
    }

    toast.success('分店已新增')
    setBranchForm({ name: '', address: '', staff_count: '2', phone: '' })
    fetchMasterData()
  }

  const handleDeleteBranch = async (id: string) => {
    if (!confirm('確定刪除此分店？將同時移除相關排班與設計師。')) return

    const res = await fetch(`/api/branches/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '刪除分店失敗' }))
      toast.error(err.error || '刪除分店失敗')
      return
    }

    toast.success('分店已刪除')
    fetchMasterData()
    fetchBookings()
  }

  const handleAddStylist = async () => {
    if (!stylistForm.branch_id || !stylistForm.name.trim()) {
      toast.error('請選擇分店並輸入設計師姓名')
      return
    }

    const res = await fetch('/api/stylists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_id: stylistForm.branch_id,
        name: stylistForm.name,
        bio: stylistForm.bio,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '新增設計師失敗' }))
      toast.error(err.error || '新增設計師失敗')
      return
    }

    toast.success('設計師已新增')
    setStylistForm({ branch_id: '', name: '', bio: '' })
    fetchMasterData()
  }

  const handleToggleStylist = async (stylist: Stylist) => {
    const res = await fetch(`/api/stylists/${stylist.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !stylist.is_active }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '更新設計師狀態失敗' }))
      toast.error(err.error || '更新設計師狀態失敗')
      return
    }

    toast.success(stylist.is_active ? '設計師已停用' : '設計師已啟用')
    fetchMasterData()
  }

  const handleDeleteStylist = async (id: string) => {
    if (!confirm('確定刪除此設計師？')) return

    const res = await fetch(`/api/stylists/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '刪除設計師失敗' }))
      toast.error(err.error || '刪除設計師失敗')
      return
    }

    toast.success('設計師已移除')
    fetchMasterData()
  }

  const handleSaveWeekly = async () => {
    if (scheduleTarget === 'branch') {
      if (!scheduleBranchId) {
        toast.error('請先選擇分店')
        return
      }

      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'branch_weekly',
          branch_id: scheduleBranchId,
          day_key: weeklyForm.dayKey,
          open_time: weeklyForm.isWorking ? weeklyForm.startTime : null,
          close_time: weeklyForm.isWorking ? weeklyForm.endTime : null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '更新分店時段失敗' }))
        toast.error(err.error || '更新分店時段失敗')
        return
      }

      toast.success('分店每週時段已更新')
      fetchSchedules()
      return
    }

    if (!scheduleStylistId) {
      toast.error('請先選擇設計師')
      return
    }

    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'stylist_weekly',
        stylist_id: scheduleStylistId,
        day_of_week: weeklyForm.dayOfWeek,
        start_time: weeklyForm.isWorking ? weeklyForm.startTime : null,
        end_time: weeklyForm.isWorking ? weeklyForm.endTime : null,
        is_working: weeklyForm.isWorking,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '更新設計師每週時段失敗' }))
      toast.error(err.error || '更新設計師每週時段失敗')
      return
    }

    toast.success('設計師每週時段已更新')
    fetchSchedules()
  }

  const handleAddOverride = async () => {
    if (!overrideForm.date) {
      toast.error('請選擇日期')
      return
    }

    if (scheduleTarget === 'branch') {
      if (!scheduleBranchId) {
        toast.error('請先選擇分店')
        return
      }

      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'branch_override',
          branch_id: scheduleBranchId,
          date: overrideForm.date,
          open_time: overrideForm.isOffOrClosed ? null : overrideForm.startTime,
          close_time: overrideForm.isOffOrClosed ? null : overrideForm.endTime,
          is_closed: overrideForm.isOffOrClosed,
          reason: overrideForm.reason,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '新增分店覆蓋設定失敗' }))
        toast.error(err.error || '新增分店覆蓋設定失敗')
        return
      }

      toast.success('分店特定日設定已儲存')
      fetchSchedules()
      fetchAllOverrides()
      return
    }

    if (!scheduleStylistId) {
      toast.error('請先選擇設計師')
      return
    }

    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'stylist_override',
        stylist_id: scheduleStylistId,
        date: overrideForm.date,
        start_time: overrideForm.isOffOrClosed ? null : overrideForm.startTime,
        end_time: overrideForm.isOffOrClosed ? null : overrideForm.endTime,
        is_off: overrideForm.isOffOrClosed,
        reason: overrideForm.reason,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '新增設計師覆蓋設定失敗' }))
      toast.error(err.error || '新增設計師覆蓋設定失敗')
      return
    }

    toast.success('設計師特定日設定已儲存')
    fetchSchedules()
    fetchAllOverrides()
  }

  const handleDeleteOverride = async (type: 'branch_override' | 'stylist_override', id: string) => {
    const res = await fetch(`/api/schedules?type=${type}&id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '刪除覆蓋設定失敗' }))
      toast.error(err.error || '刪除覆蓋設定失敗')
      return
    }

    toast.success('覆蓋設定已刪除')
    fetchSchedules()
    fetchAllOverrides()
  }

  const filteredBookings = bookings.filter((b) => {
    if (!filters.search) return true
    const q = filters.search.toLowerCase()
    return (
      b.customer_name?.toLowerCase().includes(q) ||
      b.line_id?.toLowerCase().includes(q) ||
      b.phone?.toLowerCase().includes(q)
    )
  })

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  }

  const stylistsBySelectedBranch = useMemo(
    () => stylists.filter((s) => s.branch_id === addForm.branch_id && s.is_active),
    [stylists, addForm.branch_id]
  )

  const scheduleStylists = useMemo(
    () => (scheduleBranchId ? stylists.filter((s) => s.branch_id === scheduleBranchId) : stylists),
    [stylists, scheduleBranchId]
  )

  return (
    <div className="min-h-screen pt-16">
      <div className="bg-charcoal py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-rose-light" />
              <span className="text-rose-light text-sm font-semibold uppercase tracking-widest">員工專區</span>
            </div>
            <h1 className="font-playfair text-3xl md:text-4xl text-white font-bold">管理後台</h1>
            <p className="text-white/50 text-sm mt-1">預約・分店・設計師・排班管理</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                fetchBookings()
                fetchMasterData()
                fetchSchedules()
                fetchAllOverrides()
              }}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> 重新整理
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-rose text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-rose-dark transition-colors shadow-soft"
            >
              <Plus className="w-4 h-4" /> 新增預約
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '總計', value: stats.total, icon: Calendar, color: 'text-charcoal', bg: 'bg-white' },
            { label: '已確認', value: stats.confirmed, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: '已完成', value: stats.completed, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '已取消', value: stats.cancelled, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} rounded-2xl p-5 shadow-card`}>
              <div className="flex items-center gap-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <span className="text-warmgray text-sm">{stat.label}</span>
              </div>
              <p className={`font-playfair text-3xl font-bold mt-2 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-card p-5 lg:col-span-1">
            <h2 className="font-playfair text-xl text-charcoal font-bold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-rose" /> 分店管理
            </h2>

            <div className="space-y-2 mb-4 max-h-56 overflow-auto pr-1">
              {branches.map((b) => (
                <div key={b.id} className="border border-blush rounded-xl p-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-charcoal">{b.name}</p>
                    <p className="text-xs text-warmgray">{b.address}</p>
                  </div>
                  <button onClick={() => handleDeleteBranch(b.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <input
                placeholder="分店名稱"
                value={branchForm.name}
                onChange={(e) => setBranchForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
              />
              <input
                placeholder="地址"
                value={branchForm.address}
                onChange={(e) => setBranchForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="員工數"
                  value={branchForm.staff_count}
                  onChange={(e) => setBranchForm((f) => ({ ...f, staff_count: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
                />
                <input
                  placeholder="電話"
                  value={branchForm.phone}
                  onChange={(e) => setBranchForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
                />
              </div>
              <button onClick={handleAddBranch} className="w-full bg-charcoal text-white py-2 rounded-lg text-sm font-semibold">
                新增分店
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card p-5 lg:col-span-1">
            <h2 className="font-playfair text-xl text-charcoal font-bold mb-4 flex items-center gap-2">
              <Scissors className="w-5 h-5 text-rose" /> 設計師管理
            </h2>

            <div className="space-y-2 mb-4 max-h-56 overflow-auto pr-1">
              {stylists.map((s) => {
                const branch = branches.find((b) => b.id === s.branch_id)
                return (
                  <div key={s.id} className="border border-blush rounded-xl p-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-charcoal">{s.name}</p>
                      <p className="text-xs text-warmgray">{branch?.name || '未知分店'}</p>
                      <p className={`text-[11px] mt-0.5 ${s.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                        {s.is_active ? '上班中' : '停用'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleToggleStylist(s)} className="text-xs px-2 py-1 rounded bg-blush text-charcoal">
                        {s.is_active ? '停用' : '啟用'}
                      </button>
                      <button onClick={() => handleDeleteStylist(s.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="space-y-2">
              <select
                value={stylistForm.branch_id}
                onChange={(e) => setStylistForm((f) => ({ ...f, branch_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
              >
                <option value="">選擇分店...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <input
                placeholder="設計師姓名"
                value={stylistForm.name}
                onChange={(e) => setStylistForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
              />
              <input
                placeholder="簡介（選填）"
                value={stylistForm.bio}
                onChange={(e) => setStylistForm((f) => ({ ...f, bio: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
              />
              <button onClick={handleAddStylist} className="w-full bg-charcoal text-white py-2 rounded-lg text-sm font-semibold">
                新增設計師
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card p-5 lg:col-span-1">
            <h2 className="font-playfair text-xl text-charcoal font-bold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-rose" /> 排班管理
            </h2>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setScheduleTarget('branch')}
                className={`py-2 rounded-lg text-sm font-semibold ${scheduleTarget === 'branch' ? 'bg-rose text-white' : 'bg-blush text-charcoal'}`}
              >
                分店
              </button>
              <button
                onClick={() => setScheduleTarget('stylist')}
                className={`py-2 rounded-lg text-sm font-semibold ${scheduleTarget === 'stylist' ? 'bg-rose text-white' : 'bg-blush text-charcoal'}`}
              >
                設計師
              </button>
            </div>

            <div className="space-y-2 mb-4">
              <select
                value={scheduleBranchId}
                onChange={(e) => {
                  setScheduleBranchId(e.target.value)
                  if (!scheduleStylistId) setScheduleStylistId('')
                }}
                className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
              >
                <option value="">選擇分店...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              {scheduleTarget === 'stylist' && (
                <select
                  value={scheduleStylistId}
                  onChange={(e) => setScheduleStylistId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
                >
                  <option value="">選擇設計師...</option>
                  {scheduleStylists.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2 border border-blush rounded-xl p-3 mb-3">
              <p className="text-xs font-semibold text-charcoal uppercase tracking-wide">每週時段</p>
              <select
                value={weeklyForm.dayOfWeek}
                onChange={(e) => {
                  const dayOfWeek = Number(e.target.value)
                  const selected = DAY_OPTIONS.find((day) => day.value === dayOfWeek)
                  setWeeklyForm((f) => ({
                    ...f,
                    dayOfWeek,
                    dayKey: (selected?.key || 'monday') as WeeklyForm['dayKey'],
                  }))
                }}
                className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
              >
                {DAY_OPTIONS.map((day) => (
                  <option key={day.value} value={day.value}>{day.label}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={weeklyForm.startTime}
                  onChange={(e) => setWeeklyForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
                />
                <input
                  type="time"
                  value={weeklyForm.endTime}
                  onChange={(e) => setWeeklyForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-charcoal">
                <input
                  type="checkbox"
                  checked={weeklyForm.isWorking}
                  onChange={(e) => setWeeklyForm((f) => ({ ...f, isWorking: e.target.checked }))}
                />
                此日有上班
              </label>
              <button onClick={handleSaveWeekly} className="w-full bg-charcoal text-white py-2 rounded-lg text-sm font-semibold">
                儲存每週規則
              </button>
            </div>

            <div className="space-y-2 border border-blush rounded-xl p-3">
              <p className="text-xs font-semibold text-charcoal uppercase tracking-wide">特定日覆蓋</p>
              <input
                type="date"
                value={overrideForm.date}
                onChange={(e) => setOverrideForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={overrideForm.startTime}
                  onChange={(e) => setOverrideForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
                />
                <input
                  type="time"
                  value={overrideForm.endTime}
                  onChange={(e) => setOverrideForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-charcoal">
                <input
                  type="checkbox"
                  checked={overrideForm.isOffOrClosed}
                  onChange={(e) => setOverrideForm((f) => ({ ...f, isOffOrClosed: e.target.checked }))}
                />
                {scheduleTarget === 'branch' ? '全天公休' : '設計師全天休假'}
              </label>
              <input
                placeholder="原因（選填）"
                value={overrideForm.reason}
                onChange={(e) => setOverrideForm((f) => ({ ...f, reason: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-blush text-sm"
              />
              <button onClick={handleAddOverride} className="w-full bg-charcoal text-white py-2 rounded-lg text-sm font-semibold">
                儲存特定日設定
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-playfair text-xl text-charcoal font-bold mb-3">近期覆蓋設定</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {allOverrides.branchOverrides.map((o) => (
              <div key={o.id} className="border border-blush rounded-xl p-3 text-sm flex justify-between gap-2">
                <div>
                  <p className="font-semibold text-charcoal">分店 · {o.date}</p>
                  <p className="text-warmgray text-xs">
                    {o.is_closed ? '全天公休' : `${o.open_time || '--'} - ${o.close_time || '--'}`}
                  </p>
                  {o.reason && <p className="text-xs text-warmgray mt-1">{o.reason}</p>}
                </div>
                <button onClick={() => handleDeleteOverride('branch_override', o.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {allOverrides.stylistOverrides.map((o) => (
              <div key={o.id} className="border border-blush rounded-xl p-3 text-sm flex justify-between gap-2">
                <div>
                  <p className="font-semibold text-charcoal">設計師 · {o.date}</p>
                  <p className="text-warmgray text-xs">
                    {o.is_off ? '全天休假' : `${o.start_time || '--'} - ${o.end_time || '--'}`}
                  </p>
                  {o.reason && <p className="text-xs text-warmgray mt-1">{o.reason}</p>}
                </div>
                <button onClick={() => handleDeleteOverride('stylist_override', o.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {allOverrides.branchOverrides.length === 0 && allOverrides.stylistOverrides.length === 0 && (
              <p className="text-sm text-warmgray col-span-2">目前無覆蓋設定。</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warmgray" />
              <input
                type="text"
                placeholder="搜尋姓名、LINE ID..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-blush text-sm focus:outline-none focus:border-rose bg-cream"
              />
            </div>
            <div className="relative">
              <select
                value={filters.branch_id}
                onChange={(e) => setFilters((f) => ({ ...f, branch_id: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-blush text-sm focus:outline-none focus:border-rose bg-cream appearance-none cursor-pointer"
              >
                <option value="">所有分店</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warmgray pointer-events-none" />
            </div>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-blush text-sm focus:outline-none focus:border-rose bg-cream"
            />
            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-blush text-sm focus:outline-none focus:border-rose bg-cream appearance-none cursor-pointer"
              >
                <option value="">所有狀態</option>
                <option value="confirmed">已確認</option>
                <option value="completed">已完成</option>
                <option value="cancelled">已取消</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warmgray pointer-events-none" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-rose animate-spin" />
              <span className="ml-3 text-warmgray">載入預約中...</span>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 text-rose-light mx-auto mb-4" />
              <p className="font-playfair text-xl text-charcoal font-semibold mb-2">找不到預約記錄</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full admin-table">
                <thead>
                  <tr className="border-b border-blush">
                    <th className="text-left px-6 py-4">顧客</th>
                    <th className="text-left px-6 py-4">分店</th>
                    <th className="text-left px-6 py-4">服務</th>
                    <th className="text-left px-6 py-4">設計師</th>
                    <th className="text-left px-6 py-4">日期 & 時間</th>
                    <th className="text-left px-6 py-4">狀態</th>
                    <th className="text-right px-6 py-4">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blush/50">
                  {filteredBookings.map((booking) => {
                    const branch = branches.find((b) => b.id === booking.branch_id)
                    const service = services.find((s) => s.id === booking.service_id)
                    const stylist = stylists.find((s) => s.id === booking.stylist_id)

                    return (
                      <tr key={booking.id} className="hover:bg-cream/60 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-charcoal text-sm">{booking.customer_name}</p>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <span className="text-xs text-warmgray flex items-center gap-1">
                              <MessageCircle className="w-3 h-3 text-rose" />
                              {booking.line_id}
                            </span>
                            {booking.phone && (
                              <span className="text-xs text-warmgray flex items-center gap-1">
                                <Phone className="w-3 h-3 text-rose" />
                                {booking.phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-charcoal">{branch?.name || booking.branch_id}</td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-charcoal">{service?.name || booking.service_id}</p>
                          {service && (
                            <p className="text-xs text-warmgray mt-0.5">
                              {formatPrice(service.price)} · {formatDuration(service.duration_minutes || 120)}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-charcoal">{stylist?.name || '系統自動指派'}</td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-charcoal font-medium">{booking.date}</p>
                          <p className="text-xs text-warmgray mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {booking.start_time} - {booking.end_time}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge(booking.status)}`}>
                            {STATUS_LABEL[booking.status] ?? booking.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {booking.status === 'confirmed' ? (
                              <>
                                <button
                                  onClick={() => handleComplete(booking.id)}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                  完成
                                </button>
                                <button
                                  onClick={() => handleCancel(booking.id)}
                                  className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                  取消
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-warmgray italic">無可操作</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-medium w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-7">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-playfair text-2xl text-charcoal font-bold">新增預約</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-blush rounded-full transition-colors">
                  <X className="w-5 h-5 text-warmgray" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">分店 *</label>
                  <select
                    value={addForm.branch_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, branch_id: e.target.value, stylist_id: '' }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                  >
                    <option value="">選擇分店...</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">服務 *</label>
                  <select
                    value={addForm.service_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, service_id: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                  >
                    <option value="">選擇服務...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} - {formatPrice(s.price)} ({formatDuration(s.duration_minutes || 120)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">設計師（選填）</label>
                  <select
                    value={addForm.stylist_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, stylist_id: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                  >
                    <option value="">不指定（系統自動分配）</option>
                    {stylistsBySelectedBranch.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">日期 *</label>
                    <input
                      type="date"
                      value={addForm.date}
                      onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">開始時間 *</label>
                    <input
                      type="time"
                      value={addForm.start_time}
                      onChange={(e) => setAddForm((f) => ({ ...f, start_time: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="顧客姓名 *"
                  value={addForm.customer_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, customer_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                />

                <input
                  type="text"
                  placeholder="LINE ID *"
                  value={addForm.line_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, line_id: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                />

                <input
                  type="tel"
                  placeholder="電話（選填）"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                />
              </div>

              <div className="flex gap-3 mt-7">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-xl border-2 border-blush text-warmgray font-semibold hover:bg-blush transition-colors text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleAddBooking}
                  disabled={addLoading}
                  className="flex-1 py-3 rounded-xl bg-rose text-white font-semibold hover:bg-rose-dark transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  新增預約
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
