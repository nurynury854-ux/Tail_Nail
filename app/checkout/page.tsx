'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, ClipboardList, Plus } from 'lucide-react'
import type { CheckoutOrder } from '@/lib/checkoutTypes'
import type { Stylist } from '@/lib/types'
import { formatNTD, ROLE_LABELS, useCheckoutSession } from '@/components/checkout/session'

const todayStr = () => new Date().toISOString().slice(0, 10)

function summarize(orders: CheckoutOrder[]) {
  return {
    revenue: orders.reduce((s, o) => s + (o.revenue || 0), 0),
    income: orders.reduce((s, o) => s + (o.stylist_income || 0), 0),
    count: orders.length,
    pending: orders.filter((o) => o.status !== 'confirmed').length,
  }
}

export default function CheckoutHome() {
  const { session, loading } = useCheckoutSession()
  const router = useRouter()
  const [orders, setOrders] = useState<CheckoutOrder[]>([])
  const [stylists, setStylists] = useState<Stylist[]>([])
  const [selectedStylistId, setSelectedStylistId] = useState('')

  useEffect(() => {
    if (!loading && !session) router.replace('/checkout/login')
  }, [loading, session, router])

  useEffect(() => {
    if (!session) return
    fetch(`/api/checkout/orders?date=${todayStr()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setOrders)
      .catch(() => setOrders([]))
  }, [session])

  // Owner can drill into any one stylist's performance from the dashboard.
  useEffect(() => {
    if (session?.role !== 'owner') return
    fetch('/api/stylists?active=true', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setStylists)
      .catch(() => setStylists([]))
  }, [session])

  const stats = useMemo(() => summarize(orders), [orders])
  const individual = useMemo(
    () => summarize(selectedStylistId ? orders.filter((o) => o.stylist_id_snapshot === selectedStylistId) : []),
    [orders, selectedStylistId],
  )

  if (loading || !session) return <p className="text-warmgray">載入中...</p>

  const scopeLabel =
    session.role === 'stylist' ? '我的今日' : session.role === 'manager' ? '本店今日' : '全店今日'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-playfair text-2xl text-charcoal">
          歡迎，{session.displayName}
          <span className="text-sm text-warmgray ml-2">{ROLE_LABELS[session.role]}</span>
        </h1>
        <p className="text-sm text-warmgray mt-1">{todayStr()}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={`${scopeLabel}營業額`} value={formatNTD(stats.revenue)} />
        {session.role === 'stylist' ? (
          <StatCard label="今日業績" value={formatNTD(stats.income)} />
        ) : (
          <StatCard label="今日業績總額" value={formatNTD(stats.income)} />
        )}
        <StatCard label="訂單數" value={String(stats.count)} />
        <StatCard label="待確認" value={String(stats.pending)} />
      </div>

      {/* Owner: drill into one stylist's performance (today), mirroring the overall section. */}
      {session.role === 'owner' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-playfair text-lg text-charcoal">個人業績</h2>
            <select
              value={selectedStylistId}
              onChange={(e) => setSelectedStylistId(e.target.value)}
              className="rounded-lg border border-blush px-3 py-2 text-sm"
            >
              <option value="">— 選擇美甲師 —</option>
              {stylists.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {selectedStylistId ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="今日營業額" value={formatNTD(individual.revenue)} />
              <StatCard label="今日業績" value={formatNTD(individual.income)} />
              <StatCard label="訂單數" value={String(individual.count)} />
              <StatCard label="待確認" value={String(individual.pending)} />
            </div>
          ) : (
            <p className="text-sm text-warmgray">選擇美甲師以查看其今日業績。</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* The owner oversees rather than rings up sales, so hide the entry shortcuts. */}
        {session.role !== 'owner' && (
          <>
            <ActionCard href="/checkout/orders/new" icon={<Plus size={18} />} title="手動結帳" desc="走客 / 現場新增訂單" />
            <ActionCard href="/checkout/calendar" icon={<CalendarDays size={18} />} title="從行事曆匯入" desc="點選預約自動帶入" />
          </>
        )}
        <ActionCard href="/checkout/orders" icon={<ClipboardList size={18} />} title="今日訂單" desc="查看與管理訂單" />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-blush bg-white p-4">
      <p className="text-xs text-warmgray">{label}</p>
      <p className="text-lg font-semibold text-charcoal mt-1">{value}</p>
    </div>
  )
}

function ActionCard({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="rounded-xl border border-blush bg-white p-4 hover:border-rose/50 transition block">
      <div className="flex items-center gap-2 text-rose-dark">{icon}<span className="font-semibold text-charcoal">{title}</span></div>
      <p className="text-xs text-warmgray mt-1">{desc}</p>
    </Link>
  )
}
