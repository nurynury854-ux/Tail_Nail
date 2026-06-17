'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'
import type { Branch } from '@/lib/types'
import type { BoardMessage } from '@/lib/checkoutTypes'
import { ROLE_LABELS, useCheckoutSession } from '@/components/checkout/session'

export default function MessagesPage() {
  const { session } = useCheckoutSession()
  const [branchId, setBranchId] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [messages, setMessages] = useState<BoardMessage[]>([])
  const [text, setText] = useState('')

  useEffect(() => {
    if (session?.role === 'owner') {
      fetch('/api/branches').then((r) => (r.ok ? r.json() : [])).then((b: Branch[]) => {
        setBranches(b)
        if (b[0]) setBranchId((prev) => prev || b[0].id)
      })
    } else if (session?.branchId) {
      setBranchId(session.branchId)
    }
  }, [session])

  const load = useCallback(async () => {
    if (!branchId) return
    const res = await fetch(`/api/checkout/messages?branch_id=${branchId}`, { cache: 'no-store' })
    setMessages(res.ok ? await res.json() : [])
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  const send = async () => {
    if (!text.trim()) return
    const res = await fetch('/api/checkout/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: branchId, body: text }),
    })
    if (res.ok) {
      setText('')
      load()
    } else {
      const e = await res.json().catch(() => ({}))
      toast.error(e.error || '送出失敗')
    }
  }

  const remove = async (id: string) => {
    const res = await fetch(`/api/checkout/messages/${id}`, { method: 'DELETE' })
    if (res.ok) load()
    else toast.error('刪除失敗')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-playfair text-2xl text-charcoal">留言板</h1>
      <p className="text-sm text-warmgray">店長與老闆的內部溝通，各分店獨立。例如：缺貨通知，處理完即可刪除。</p>

      {session?.role === 'owner' && (
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-lg border border-blush px-3 py-2 text-sm">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}

      <div className="rounded-2xl border border-blush bg-white p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="輸入訊息..."
          className="w-full rounded-lg border border-blush px-3 py-2 text-sm"
        />
        <div className="flex justify-end mt-2">
          <button onClick={send} className="bg-rose text-white px-5 py-2 rounded-lg text-sm hover:opacity-90">送出</button>
        </div>
      </div>

      <ul className="space-y-2">
        {messages.length === 0 && <li className="text-warmgray text-sm">尚無訊息</li>}
        {messages.map((m) => (
          <li key={m.id} className="rounded-xl border border-blush bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-charcoal text-sm whitespace-pre-wrap">{m.body}</p>
                <p className="text-xs text-warmgray mt-1">
                  {m.author_name}・{ROLE_LABELS[m.author_role as keyof typeof ROLE_LABELS] || m.author_role}
                  {m.created_at ? `・${new Date(m.created_at).toLocaleString('zh-TW')}` : ''}
                </p>
              </div>
              <button onClick={() => remove(m.id)} className="text-warmgray hover:text-rose-dark shrink-0" aria-label="刪除">
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
