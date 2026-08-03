'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'
import type { Branch, Stylist } from '@/lib/types'
import type { FixedBonus, PerformanceBonus } from '@/lib/checkoutTypes'
import { formatNTD } from './session'

/** Owner-only bonus editor. Staff get the read-only MyBonuses view instead. */
export default function BonusAdmin() {
  const [fixed, setFixed] = useState<FixedBonus[]>([])
  const [performance, setPerformance] = useState<PerformanceBonus[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [stylists, setStylists] = useState<Stylist[]>([])

  const [fixedForm, setFixedForm] = useState({ stylist_id: '', amount: '' })
  // 業績獎金 is branch-level only — no stylist target.
  const [perfForm, setPerfForm] = useState({ branch_id: '', revenue_threshold: '', bonus_amount: '' })

  // Amounts are edited in place so a change never stacks a second active row.
  const [editFixed, setEditFixed] = useState<{ id: string; amount: string } | null>(null)
  const [editPerf, setEditPerf] = useState<{ id: string; revenue_threshold: string; bonus_amount: string } | null>(null)

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

  const patch = async (payload: object, ok: string) => {
    const res = await fetch('/api/checkout/bonuses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
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
    if (!perfForm.branch_id) return toast.error('請選擇分店')
    const okAdd = await post(
      {
        type: 'performance',
        branch_id_snapshot: perfForm.branch_id,
        revenue_threshold: Number(perfForm.revenue_threshold),
        bonus_amount: Number(perfForm.bonus_amount),
      },
      '已新增業績獎金',
    )
    if (okAdd) setPerfForm({ branch_id: '', revenue_threshold: '', bonus_amount: '' })
  }

  const saveFixed = async () => {
    if (!editFixed) return
    if (await patch({ type: 'fixed', id: editFixed.id, amount: Number(editFixed.amount) }, '已更新固定獎金')) {
      setEditFixed(null)
    }
  }

  const savePerf = async () => {
    if (!editPerf) return
    const okSave = await patch(
      {
        type: 'performance',
        id: editPerf.id,
        revenue_threshold: Number(editPerf.revenue_threshold),
        bonus_amount: Number(editPerf.bonus_amount),
      },
      '已更新業績獎金',
    )
    if (okSave) setEditPerf(null)
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
  const linkCls = 'text-warmgray hover:text-rose-dark'

  return (
    <div className="space-y-6">
      <h1 className="font-playfair text-2xl text-charcoal">獎金設定</h1>

      {/* Fixed bonus */}
      <section className="rounded-2xl border border-blush bg-white p-5 space-y-3">
        <h2 className="font-playfair text-lg text-charcoal">固定獎金</h2>
        <p className="text-xs text-warmgray">
          設定一次後每月自動發放，可隨時調整或移除。每位美甲師僅能有一筆啟用中的固定獎金，調整金額請直接修改。
        </p>
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
            <li key={b.id} className="flex items-center justify-between py-2 text-sm gap-3">
              {editFixed?.id === b.id ? (
                <>
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-charcoal">{b.stylist_name_snapshot || stylistName(b.stylist_id_snapshot)}</span>
                    <input
                      className={`${inputCls} w-28`}
                      type="number"
                      autoFocus
                      value={editFixed.amount}
                      onChange={(e) => setEditFixed({ ...editFixed, amount: e.target.value })}
                    />
                    <span className="text-warmgray">／月</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <button onClick={saveFixed} className="text-rose-dark hover:opacity-80">儲存</button>
                    <button onClick={() => setEditFixed(null)} className={linkCls}>取消</button>
                  </span>
                </>
              ) : (
                <>
                  <span className={b.is_active ? 'text-charcoal' : 'text-warmgray line-through'}>
                    {b.stylist_name_snapshot || stylistName(b.stylist_id_snapshot)}・{formatNTD(b.amount)}／月
                  </span>
                  <span className="flex items-center gap-3">
                    <button onClick={() => setEditFixed({ id: b.id, amount: String(b.amount) })} className={linkCls}>修改</button>
                    <button onClick={() => toggle('fixed', b.id, !b.is_active)} className={linkCls}>
                      {b.is_active ? '停用' : '啟用'}
                    </button>
                    <button onClick={() => remove('fixed', b.id)} className={linkCls}><Trash2 size={15} /></button>
                  </span>
                </>
              )}
            </li>
          ))}
          {fixed.length === 0 && <li className="py-2 text-warmgray text-sm">尚未設定</li>}
        </ul>
      </section>

      {/* Performance bonus */}
      <section className="rounded-2xl border border-blush bg-white p-5 space-y-3">
        <h2 className="font-playfair text-lg text-charcoal">業績獎金</h2>
        <p className="text-xs text-warmgray">
          依分店當月營業額計算，達標後自動發放給該分店店長。僅能以分店為單位設定。
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <select className={inputCls} value={perfForm.branch_id} onChange={(e) => setPerfForm({ ...perfForm, branch_id: e.target.value })}>
            <option value="">— 分店 —</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input className={inputCls} type="number" placeholder="營業額門檻" value={perfForm.revenue_threshold} onChange={(e) => setPerfForm({ ...perfForm, revenue_threshold: e.target.value })} />
          <input className={inputCls} type="number" placeholder="獎金金額" value={perfForm.bonus_amount} onChange={(e) => setPerfForm({ ...perfForm, bonus_amount: e.target.value })} />
          <button onClick={addPerf} className="bg-rose text-white px-4 py-2 rounded-lg text-sm hover:opacity-90">新增</button>
        </div>
        <ul className="divide-y divide-blush/60">
          {performance.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-2 text-sm gap-3">
              {editPerf?.id === b.id ? (
                <>
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-charcoal">{branchName(b.branch_id_snapshot)}</span>
                    <span className="text-warmgray">達</span>
                    <input
                      className={`${inputCls} w-32`}
                      type="number"
                      autoFocus
                      value={editPerf.revenue_threshold}
                      onChange={(e) => setEditPerf({ ...editPerf, revenue_threshold: e.target.value })}
                    />
                    <span className="text-warmgray">→</span>
                    <input
                      className={`${inputCls} w-28`}
                      type="number"
                      value={editPerf.bonus_amount}
                      onChange={(e) => setEditPerf({ ...editPerf, bonus_amount: e.target.value })}
                    />
                  </span>
                  <span className="flex items-center gap-3">
                    <button onClick={savePerf} className="text-rose-dark hover:opacity-80">儲存</button>
                    <button onClick={() => setEditPerf(null)} className={linkCls}>取消</button>
                  </span>
                </>
              ) : (
                <>
                  <span className={b.is_active ? 'text-charcoal' : 'text-warmgray line-through'}>
                    {branchName(b.branch_id_snapshot)}
                    ・達 {formatNTD(b.revenue_threshold)} → {formatNTD(b.bonus_amount)}（店長）
                  </span>
                  <span className="flex items-center gap-3">
                    <button
                      onClick={() => setEditPerf({ id: b.id, revenue_threshold: String(b.revenue_threshold), bonus_amount: String(b.bonus_amount) })}
                      className={linkCls}
                    >
                      修改
                    </button>
                    <button onClick={() => toggle('performance', b.id, !b.is_active)} className={linkCls}>
                      {b.is_active ? '停用' : '啟用'}
                    </button>
                    <button onClick={() => remove('performance', b.id)} className={linkCls}><Trash2 size={15} /></button>
                  </span>
                </>
              )}
            </li>
          ))}
          {performance.length === 0 && <li className="py-2 text-warmgray text-sm">尚未設定</li>}
        </ul>
      </section>
    </div>
  )
}
