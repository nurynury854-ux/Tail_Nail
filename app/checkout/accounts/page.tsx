'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'
import type { Branch, Stylist } from '@/lib/types'
import type { Account, CheckoutRole } from '@/lib/checkoutTypes'
import { ROLE_LABELS, useCheckoutSession } from '@/components/checkout/session'

export default function AccountsPage() {
  const { session } = useCheckoutSession()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [stylists, setStylists] = useState<Stylist[]>([])

  const [form, setForm] = useState({
    username: '',
    password: '',
    display_name: '',
    role: 'stylist' as CheckoutRole,
    branch_id: '',
    stylist_id: '',
    subtitle: '',
  })
  const [busy, setBusy] = useState(false)

  const loadAccounts = () =>
    fetch('/api/checkout/accounts').then((r) => (r.ok ? r.json() : [])).then(setAccounts)

  useEffect(() => {
    loadAccounts()
    fetch('/api/branches').then((r) => (r.ok ? r.json() : [])).then(setBranches)
    fetch('/api/stylists?active=false').then((r) => (r.ok ? r.json() : [])).then(setStylists)
  }, [])

  const branchName = (id?: string | null) => branches.find((b) => b.id === id)?.name || '—'

  const create = async () => {
    if (!form.username || !form.password || !form.display_name) {
      toast.error('請填寫帳號、密碼、顯示名稱')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/checkout/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          branch_id: form.branch_id || null,
          stylist_id: form.stylist_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '建立失敗')
        return
      }
      toast.success('已建立帳號')
      setForm({ username: '', password: '', display_name: '', role: 'stylist', branch_id: '', stylist_id: '', subtitle: '' })
      loadAccounts()
    } finally {
      setBusy(false)
    }
  }

  const patch = async (id: string, body: object, msg = '已更新') => {
    const res = await fetch(`/api/checkout/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast.success(msg)
      loadAccounts()
    } else {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error || '更新失敗')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('刪除此帳號？歷史營業額會保留於原分店。')) return
    const res = await fetch(`/api/checkout/accounts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('已刪除')
      loadAccounts()
    } else toast.error('刪除失敗')
  }

  const inputCls = 'rounded-lg border border-blush px-3 py-2 text-sm w-full'

  return (
    <div className="space-y-6">
      <h1 className="font-playfair text-2xl text-charcoal">帳號管理</h1>

      {/* Create */}
      <div className="rounded-2xl border border-blush bg-white p-5 space-y-3">
        <h2 className="font-playfair text-lg text-charcoal">新增帳號</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={inputCls} placeholder="帳號" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className={inputCls} type="password" placeholder="密碼" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className={inputCls} placeholder="顯示名稱" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as CheckoutRole })}>
            <option value="stylist">美甲師</option>
            <option value="manager">店長</option>
            <option value="owner">老闆</option>
          </select>
          <select className={inputCls} value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
            <option value="">— 分店 —</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className={inputCls} value={form.stylist_id} onChange={(e) => setForm({ ...form, stylist_id: e.target.value })}>
            <option value="">— 連結美甲師（選填）—</option>
            {stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className={`${inputCls} sm:col-span-2`} placeholder="副標題 / 備註（例如：店長）" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
        </div>
        <button onClick={create} disabled={busy} className="bg-rose text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          建立帳號
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {accounts.map((a) => (
          <div key={a.id} className="rounded-xl border border-blush bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-charcoal font-semibold">
                  {a.display_name}
                  <span className="text-xs text-warmgray ml-2">@{a.username}・{ROLE_LABELS[a.role]}</span>
                  {!a.is_active && <span className="text-xs text-rose-dark ml-2">（停用）</span>}
                </p>
                {a.subtitle && <p className="text-xs text-warmgray">{a.subtitle}</p>}
                <p className="text-xs text-warmgray mt-1">分店：{branchName(a.branch_id)}</p>
              </div>
              <button onClick={() => remove(a.id)} className="text-warmgray hover:text-rose-dark" aria-label="刪除">
                <Trash2 size={16} />
              </button>
            </div>

            {a.role !== 'owner' && (
              <div className="flex flex-wrap gap-2 mt-3 text-sm">
                <label className="text-warmgray">轉店：</label>
                <select
                  value={a.branch_id || ''}
                  onChange={(e) => patch(a.id, { branch_id: e.target.value || null }, '已轉店（歷史業績留在原店）')}
                  className="rounded-lg border border-blush px-2 py-1 text-sm"
                >
                  <option value="">—</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button
                  onClick={() => {
                    const next = a.role === 'manager' ? 'stylist' : 'manager'
                    const label = next === 'manager' ? '店長' : '美甲師'
                    if (confirm(`將此帳號切換為${label}？資料會保留。`)) {
                      patch(a.id, { role: next }, `已切換為${label}`)
                    }
                  }}
                  className="px-3 py-1 rounded-lg border border-rose text-rose-dark hover:bg-rose/5"
                >
                  {a.role === 'manager' ? '設為美甲師' : '設為店長'}
                </button>
                <button
                  onClick={() => patch(a.id, { is_active: !a.is_active })}
                  className="px-3 py-1 rounded-lg border border-blush hover:border-rose/50"
                >
                  {a.is_active ? '停用' : '啟用'}
                </button>
                <button
                  onClick={() => {
                    const pw = prompt('輸入新密碼')
                    if (pw) patch(a.id, { password: pw }, '已重設密碼')
                  }}
                  className="px-3 py-1 rounded-lg border border-blush hover:border-rose/50"
                >
                  重設密碼
                </button>
                <button
                  onClick={() => {
                    const sub = prompt('副標題 / 備註', a.subtitle || '')
                    if (sub !== null) patch(a.id, { subtitle: sub })
                  }}
                  className="px-3 py-1 rounded-lg border border-blush hover:border-rose/50"
                >
                  編輯備註
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
