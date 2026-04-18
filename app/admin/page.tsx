'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, Filter, Plus, X, RefreshCw, Loader2, ChevronDown,
  CheckCircle, XCircle, Clock, Calendar, Users, Sparkles, Phone, MessageCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Booking, BRANCHES, SERVICES } from '@/lib/types'
import { formatDisplayDate, formatPrice, formatDuration, calculateEndTime } from '@/lib/bookingUtils'

type FilterState = {
  branch_id: string
  date: string
  status: string
  search: string
}

type ManualBooking = {
  branch_id: string
  service_id: string
  date: string
  start_time: string
  customer_name: string
  line_id: string
  phone: string
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
    branch_id: '', service_id: '', date: '', start_time: '',
    customer_name: '', line_id: '', phone: '',
  })
  const [addLoading, setAddLoading] = useState(false)

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
      toast.error('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }, [filters.branch_id, filters.date, filters.status])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this booking?')) return
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (res.ok) {
        toast.success('Booking cancelled')
        fetchBookings()
      } else {
        toast.error('Failed to cancel booking')
      }
    } catch {
      toast.error('Error cancelling booking')
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
        toast.success('Marked as completed')
        fetchBookings()
      }
    } catch {
      toast.error('Error updating booking')
    }
  }

  const handleAddBooking = async () => {
    const { branch_id, service_id, date, start_time, customer_name, line_id } = addForm
    if (!branch_id || !service_id || !date || !start_time || !customer_name || !line_id) {
      toast.error('Please fill in all required fields')
      return
    }
    setAddLoading(true)
    try {
      const service = SERVICES.find((s) => s.id === service_id)
      const end_time = calculateEndTime(start_time, service?.duration_minutes || 60)
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, end_time, status: 'confirmed' }),
      })
      if (res.ok) {
        toast.success('Booking added successfully')
        setShowAddModal(false)
        setAddForm({ branch_id: '', service_id: '', date: '', start_time: '', customer_name: '', line_id: '', phone: '' })
        fetchBookings()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to add booking')
      }
    } catch {
      toast.error('Error adding booking')
    } finally {
      setAddLoading(false)
    }
  }

  // Filter bookings by search
  const filtered = bookings.filter((b) => {
    if (!filters.search) return true
    const q = filters.search.toLowerCase()
    return (
      b.customer_name?.toLowerCase().includes(q) ||
      b.line_id?.toLowerCase().includes(q) ||
      b.phone?.toLowerCase().includes(q)
    )
  })

  // Stats
  const stats = {
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  }

  return (
    <div className="min-h-screen bg-cream pt-16">
      {/* Header */}
      <div className="bg-charcoal py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-rose-light" />
              <span className="text-rose-light text-sm font-semibold uppercase tracking-widest">Staff Area</span>
            </div>
            <h1 className="font-playfair text-3xl md:text-4xl text-white font-bold">Admin Dashboard</h1>
            <p className="text-white/50 text-sm mt-1">Lumière Nails · Booking Management</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchBookings}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-rose text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-rose-dark transition-colors shadow-soft"
            >
              <Plus className="w-4 h-4" /> Add Booking
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total, icon: Calendar, color: 'text-charcoal', bg: 'bg-white' },
            { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Cancelled', value: stats.cancelled, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
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

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-card p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warmgray" />
              <input
                type="text"
                placeholder="Search name, LINE ID..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-blush text-sm focus:outline-none focus:border-rose bg-cream"
              />
            </div>

            {/* Branch filter */}
            <div className="relative">
              <select
                value={filters.branch_id}
                onChange={(e) => setFilters((f) => ({ ...f, branch_id: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-blush text-sm focus:outline-none focus:border-rose bg-cream appearance-none cursor-pointer"
              >
                <option value="">All Branches</option>
                {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warmgray pointer-events-none" />
            </div>

            {/* Date filter */}
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-blush text-sm focus:outline-none focus:border-rose bg-cream"
            />

            {/* Status filter */}
            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-blush text-sm focus:outline-none focus:border-rose bg-cream appearance-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warmgray pointer-events-none" />
            </div>
          </div>

          {(filters.branch_id || filters.date || filters.status || filters.search) && (
            <button
              onClick={() => setFilters({ branch_id: '', date: '', status: '', search: '' })}
              className="mt-3 flex items-center gap-1.5 text-warmgray hover:text-rose text-xs transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-rose animate-spin" />
              <span className="ml-3 text-warmgray">Loading bookings...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24">
              <Calendar className="w-12 h-12 text-rose-light mx-auto mb-4" />
              <p className="font-playfair text-xl text-charcoal font-semibold mb-2">No bookings found</p>
              <p className="text-warmgray text-sm">Try adjusting your filters or add a new booking.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full admin-table">
                <thead>
                  <tr className="border-b border-blush">
                    <th className="text-left px-6 py-4">Customer</th>
                    <th className="text-left px-6 py-4">Branch</th>
                    <th className="text-left px-6 py-4">Service</th>
                    <th className="text-left px-6 py-4">Date & Time</th>
                    <th className="text-left px-6 py-4">Status</th>
                    <th className="text-right px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blush/50">
                  {filtered.map((booking) => {
                    const branch = BRANCHES.find((b) => b.id === booking.branch_id)
                    const service = SERVICES.find((s) => s.id === booking.service_id)
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
                        <td className="px-6 py-4">
                          <span className="text-sm text-charcoal">{branch?.name || booking.branch_id}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-charcoal">{service?.name || booking.service_id}</p>
                          {service && (
                            <p className="text-xs text-warmgray mt-0.5">
                              {formatPrice(service.price)} · {formatDuration(service.duration_minutes)}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-charcoal font-medium">{booking.date}</p>
                          <p className="text-xs text-warmgray mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {booking.start_time} – {booking.end_time}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge(booking.status)}`}>
                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {booking.status === 'confirmed' && (
                              <>
                                <button
                                  onClick={() => handleComplete(booking.id)}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                  Complete
                                </button>
                                <button
                                  onClick={() => handleCancel(booking.id)}
                                  className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {booking.status !== 'confirmed' && (
                              <span className="text-xs text-warmgray italic">No actions</span>
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

          {filtered.length > 0 && (
            <div className="px-6 py-4 border-t border-blush bg-cream/50 text-xs text-warmgray">
              Showing {filtered.length} of {bookings.length} bookings
            </div>
          )}
        </div>
      </div>

      {/* Add Booking Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-medium w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-7">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-playfair text-2xl text-charcoal font-bold">Add Booking</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-blush rounded-full transition-colors">
                  <X className="w-5 h-5 text-warmgray" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Branch */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">Branch *</label>
                  <select
                    value={addForm.branch_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, branch_id: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                  >
                    <option value="">Select branch...</option>
                    {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                {/* Service */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">Service *</label>
                  <select
                    value={addForm.service_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, service_id: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                  >
                    <option value="">Select service...</option>
                    {SERVICES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} – {formatPrice(s.price)} ({formatDuration(s.duration_minutes)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">Date *</label>
                    <input
                      type="date"
                      value={addForm.date}
                      onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">Start Time *</label>
                    <select
                      value={addForm.start_time}
                      onChange={(e) => setAddForm((f) => ({ ...f, start_time: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                    >
                      <option value="">Select time...</option>
                      {Array.from({ length: 10 }, (_, i) => `${String(i + 10).padStart(2, '0')}:00`).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">Customer Name *</label>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={addForm.customer_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, customer_name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                  />
                </div>

                {/* LINE ID */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">LINE ID *</label>
                  <input
                    type="text"
                    placeholder="@lineid"
                    value={addForm.line_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, line_id: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wide">Phone (optional)</label>
                  <input
                    type="tel"
                    placeholder="09XX-XXX-XXX"
                    value={addForm.phone}
                    onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-blush focus:outline-none focus:border-rose text-sm bg-cream"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-7">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-xl border-2 border-blush text-warmgray font-semibold hover:bg-blush transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddBooking}
                  disabled={addLoading}
                  className="flex-1 py-3 rounded-xl bg-rose text-white font-semibold hover:bg-rose-dark transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
