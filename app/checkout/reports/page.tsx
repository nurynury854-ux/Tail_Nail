'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatNTD, useCheckoutSession } from '@/components/checkout/session'

interface ReportData {
  range: { month?: string; date?: string }
  totals: { revenue: number; income: number; orderCount: number; bonus?: number }
  payment: { cash: number; transfer: number; unset: number }
  byStylist: Array<{ stylist_name: string; branch_name: string; orderCount: number; revenue: number; income: number; bonus?: number }>
  byBranch: Array<{ branch_name: string; orderCount: number; revenue: number; income: number; bonus?: number }>
}

const monthStr = () => new Date().toISOString().slice(0, 7)
const dayStr = () => new Date().toISOString().slice(0, 10)

export default function ReportsPage() {
  const { session } = useCheckoutSession()
  const [mode, setMode] = useState<'month' | 'day'>('month')
  const [month, setMonth] = useState(monthStr())
  const [day, setDay] = useState(dayStr())
  const [data, setData] = useState<ReportData | null>(null)

  const load = useCallback(async () => {
    const q = mode === 'month' ? `month=${month}` : `date=${day}`
    const res = await fetch(`/api/checkout/reports?${q}`, { cache: 'no-store' })
    setData(res.ok ? await res.json() : null)
  }, [mode, month, day])

  useEffect(() => {
    load()
  }, [load])

  const inputCls = 'rounded-lg border border-blush px-3 py-2 text-sm'

  return (
    <div className="space-y-5">
      <h1 className="font-playfair text-2xl text-charcoal">報表</h1>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-blush overflow-hidden">
          {(['month', 'day'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-sm ${mode === m ? 'bg-rose text-white' : 'bg-white text-charcoal'}`}
            >
              {m === 'month' ? '月' : '日'}
            </button>
          ))}
        </div>
        {mode === 'month' ? (
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls} />
        ) : (
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputCls} />
        )}
      </div>

      {!data ? (
        <p className="text-warmgray">載入中...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="總營業額" value={formatNTD(data.totals.revenue)} />
            <Stat label="總業績" value={formatNTD(data.totals.income)} />
            {mode === 'month' && <Stat label="總獎金" value={formatNTD(data.totals.bonus || 0)} />}
            <Stat label="訂單數" value={String(data.totals.orderCount)} />
            <Stat label="現金 / 轉帳" value={`${formatNTD(data.payment.cash)} / ${formatNTD(data.payment.transfer)}`} small />
          </div>

          {session?.role === 'owner' && data.byBranch.length > 0 && (
            <Section title="各分店">
              <Table
                head={mode === 'month' ? ['分店', '訂單', '營業額', '業績', '獎金'] : ['分店', '訂單', '營業額', '業績']}
                rows={data.byBranch.map((b) => {
                  const base = [b.branch_name, String(b.orderCount), formatNTD(b.revenue), formatNTD(b.income)]
                  return mode === 'month' ? [...base, formatNTD(b.bonus || 0)] : base
                })}
              />
            </Section>
          )}

          <Section title="個人業績">
            <Table
              head={mode === 'month' ? ['美甲師', '分店', '訂單', '營業額', '業績', '獎金'] : ['美甲師', '分店', '訂單', '營業額', '業績']}
              rows={data.byStylist.map((s) => {
                const base = [s.stylist_name, s.branch_name, String(s.orderCount), formatNTD(s.revenue), formatNTD(s.income)]
                return mode === 'month' ? [...base, formatNTD(s.bonus || 0)] : base
              })}
            />
          </Section>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-blush bg-white p-4">
      <p className="text-xs text-warmgray">{label}</p>
      <p className={`font-semibold text-charcoal mt-1 ${small ? 'text-sm' : 'text-lg'}`}>{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-playfair text-lg text-charcoal mb-2">{title}</h2>
      {children}
    </div>
  )
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p className="text-warmgray text-sm">無資料</p>
  return (
    <div className="overflow-x-auto rounded-xl border border-blush bg-white">
      <table className="w-full text-sm">
        <thead className="text-warmgray border-b border-blush">
          <tr className="text-left">
            {head.map((h, i) => (
              <th key={i} className={`px-3 py-2 ${i >= 2 ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-blush/60 last:border-0">
              {r.map((c, ci) => (
                <td key={ci} className={`px-3 py-2 text-charcoal ${ci >= 2 ? 'text-right' : ''}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
