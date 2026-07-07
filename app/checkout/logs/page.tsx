'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { OrderEditLog } from '@/lib/checkoutTypes'

const ACTION_LABELS: Record<string, string> = {
  create: '建立訂單',
  edit: '修改訂單',
  submit: '送出訂單',
  confirm: '確認鎖定',
  blocked_edit_attempt: '嘗試修改已鎖定訂單',
  delete: '刪除訂單',
  actual_amount_adjust: '實收金額調整',
  cancel_appointment: '取消預約',
}

export default function LogsPage() {
  const [logs, setLogs] = useState<OrderEditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/checkout/logs', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="font-playfair text-2xl text-charcoal">修改記錄</h1>
      <p className="text-sm text-warmgray">所有訂單的建立、修改、送出、確認與嘗試修改記錄。</p>

      {loading ? (
        <p className="text-warmgray">載入中...</p>
      ) : logs.length === 0 ? (
        <p className="text-warmgray">尚無記錄</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => {
            const blocked = log.action === 'blocked_edit_attempt'
            return (
              <li
                key={log.id}
                className={`rounded-xl border bg-white p-3 text-sm ${blocked ? 'border-rose/40' : 'border-blush'}`}
              >
                <span className={blocked ? 'text-rose-dark font-semibold' : 'text-charcoal font-semibold'}>
                  {log.actor_name}
                </span>{' '}
                <span className="text-warmgray">{ACTION_LABELS[log.action] || log.action}</span>
                {log.order_id && (
                  <>
                    {' '}
                    <Link href={`/checkout/orders/${log.order_id}`} className="text-rose-dark hover:underline">
                      （檢視訂單）
                    </Link>
                  </>
                )}
                <span className="text-warmgray">
                  {log.created_at ? `・${new Date(log.created_at).toLocaleString('zh-TW')}` : ''}
                </span>
                {log.reason && <p className="text-xs text-warmgray mt-1">原因：{log.reason}</p>}
                {log.field_changes && log.field_changes.length > 0 && (
                  <p className="text-xs text-warmgray mt-1">
                    變更：{log.field_changes.map((c) => c.field).join('、')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
