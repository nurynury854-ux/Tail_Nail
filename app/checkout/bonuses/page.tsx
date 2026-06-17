'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'
import type { Branch, Stylist } from '@/lib/types'
import type { FixedBonus, PerformanceBonus } from '@/lib/checkoutTypes'
import { formatNTD } from '@/components/checkout/session'

export default function BonusesPage() {
  const [fixed, setFixed] = useState<FixedBonus[]>([])
  const [performance, setPerformance] = useState<PerformanceBonus[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [stylists, setStylists] = useState<Stylist[]>([])

  const [fixedForm, setFixedForm] = useState({ stylist_id: '', amount: '' })
  const [perfForm, setPerfForm] = useState({ scope: 'stylist', stylist_id: '', branch_id: '', revenue_threshold: '', bonus_amount: '' })

  const load = () =>
    fetch('/api/checkout/bonuses').then((r) => (r.ok ? r.json() : { fixed: [], performance: [] })).then((d) => {
      setFixed(d.fixed)
      setPerformance(d.performance)
    })

  useEffect(() => {
    load()
    fetch('/api/branches').then((r) => (r.ok ? r.json() : [])).then(setBranches)
    fetch('/api/stylists?active=false').then((r) => (r.ok ? r.json() : [])).then(setStylists)
  }, [])

  const stylistName = (id?: string | null) => stylists.find((s) => s.id === id)?.name || id || '—'
  const branchName = (id?: string | null) => branches.find((b) => b.id === id)?.name || id || '—'

  const post = async (payload: object, ok: string) => {
    const res = await fetch('/api/checkout/bonuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || '儲存失敗')
      return false
    }
    toast.success(ok)
    load()
    return true
  }

  const addFixed = async () => {
    if (!fixedForm.stylist_id || !fixedForm.amount) return toast.error('請選擇美甲師並輸入金額')
    const okAdd = await post(
      { type: 'fixed', stylist_id_snapshot: fixedForm.stylist_id, stylist_name_snapshot: stylistName(fixedForm.stylist_id), amount: Number(fixedForm.amount) },
      '已新增固定獎金',
    )
    if (okAdd) setFixedForm({ stylist_id: '', amount: '' })
  }

  const addPerf = async () => {
    const okAdd = await post(
      {
        type: 'performance',
        scope: perfForm.scope,
        stylist_id_snapshot: perfForm.stylist_id,
        branch_id_snapshot: perfForm.branch_id,
        revenue_threshold: Number(perfForm.revenue_threshold),
        bonus_amount: Number(perfForm.bonus_amount),
      },
      '已新增業績獎金',
    )
    if (okAdd) setPerfForm({ scope: 'stylist', stylist_id: '', branch_id: '', revenue_threshold: '', bonus_amount: '' })
  }

  const toggle = async (type: 'fixed' | 'performance', id: string, is_active: boolean) => {
    await fetch('/api/checkout/bonuses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, is_active }),
    })
    load()
  }

  const remove = async (type: 'fixed' | 'performance', id: string) => {
    if (!confirm('刪除此獎金？')) return
    await fetch(`/api/checkout/bonuses?type=${type}&id=${id}`, { method: 'DELETE' })
    load()
  }

  const inputCls = 'rounded-lg border border-blush px-3 py-2 text-sm'

  return (
    <div className="space-y-6">
      <h1 className="font-playfair text-2xl text-charcoal">獎金設定</h1>

      {/* Fixed bonus */}
      <section className="rounded-2xl border border-blush bg-white p-5 space-y-3">
        <h2 className="font-playfair text-lg text-charcoal">固定獎金</h2>
        <p className="text-xs text-warmgray">設定一次後每月自動發放，可隨時調整或移除。</p>
        <div className="flex flex-wrap gap-2">
          <select className={inputCls} value={fixedForm.stylist_id} onChange={(e) => setFixedForm({ ...fixedForm, stylist_id: e.target.value })}>
            <option value="">— 美甲師 —</option>
            {stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className={inputCls} type="number" placeholder="金額" value={fixedForm.amount} onChange={(e) => setFixedForm({ ...fixedForm, amount: e.target.value })} />
          <button onClick={addFixed} className="bg-rose text-white px-4 py-2 rounded-lg text-sm hover:opacity-90">新增</button>
        </div>
        <ul className="divide-y divide-blush/60">
          {fixed.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-2 text-sm">
              <span className={b.is_active ? 'text-charcoal' : 'text-warmgray line-through'}>
                {b.stylist_name_snapshot || stylistName(b.stylist_id_snapshot)}・{formatNTD(b.amount)}／月
              </span>
              <span className="flex items-center gap-3">
                <button onClick={() => toggle('fixed', b.id, !b.is_active)} className="text-warmgray hover:text-rose-dark">
                  {b.is_active ? '停用' : '啟用'}
                </button>
                <button onClick={() => remove('fixed', b.id)} className="text-warmgray hover:text-rose-dark"><Trash2 size={15} /></button>
              </span>
            </li>
          ))}
          {fixed.length === 0 && <li className="py-2 text-warmgray text-sm">尚未設定</li>}
        </ul>
      </section>

      {/* Performance bonus */}
      <section className="rounded-2xl border border-blush bg-white p-5 space-y-3">
        <h2 className="font-playfair text-lg text-charcoal">業績獎金</h2>
        <p className="text-xs text-warmgray">當月營業額達到門檻時自動發放對應獎金。</p>
        <div className="flex flex-wrap gap-2 items-center">
          <select className={inputCls} value={perfForm.scope} onChange={(e) => setPerfForm({ ...perfForm, scope: e.target.value })}>
            <option value="stylist">個人</option>
            <option value="branch">分店</option>
          </select>
          {perfForm.scope === 'stylist' ? (
            <select className={inputCls} value={perfForm.stylist_id} onChange={(e) => setPerfForm({ ...perfForm, stylist_id: e.target.value })}>
              <option value="">— 美甲師 —</option>
              {stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : (
            <select className={inputCls} value={perfForm.branch_id} onChange={(e) => setPerfForm({ ...perfForm, branch_id: e.target.value })}>
              <option value="">— 分店 —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <input className={inputCls} type="number" placeholder="營業額門檻" value={perfForm.revenue_threshold} onChange={(e) => setPerfForm({ ...perfForm, revenue_threshold: e.target.value })} />
          <input className={inputCls} type="number" placeholder="獎金金額" value={perfForm.bonus_amount} onChange={(e) => setPerfForm({ ...perfForm, bonus_amount: e.target.value })} />
          <button onClick={addPerf} className="bg-rose text-white px-4 py-2 rounded-lg text-sm hover:opacity-90">新增</button>
        </div>
        <ul className="divide-y divide-blush/60">
          {performance.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-2 text-sm">
              <span className={b.is_active ? 'text-charcoal' : 'text-warmgray line-through'}>
                {b.scope === 'stylist' ? stylistName(b.stylist_id_snapshot) : branchName(b.branch_id_snapshot)}
                ・達 {formatNTD(b.revenue_threshold)} → {formatNTD(b.bonus_amount)}
              </span>
              <span className="flex items-center gap-3">
                <button onClick={() => toggle('performance', b.id, !b.is_active)} className="text-warmgray hover:text-rose-dark">
                  {b.is_active ? '停用' : '啟用'}
                </button>
                <button onClick={() => remove('performance', b.id)} className="text-warmgray hover:text-rose-dark"><Trash2 size={15} /></button>
              </span>
            </li>
          ))}
          {performance.length === 0 && <li className="py-2 text-warmgray text-sm">尚未設定</li>}
        </ul>
      </section>
    </div>
  )
}
