'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: '登入失敗' }))
        toast.error(data.error || '登入失敗')
        return
      }

      toast.success('登入成功')
      router.replace('/admin')
      router.refresh()
    } catch {
      toast.error('登入失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-8 border border-blush">
        <h1 className="font-playfair text-3xl text-charcoal font-bold mb-2">管理員登入</h1>
        <p className="text-sm text-warmgray mb-6">請輸入店家後台帳號與密碼</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-charcoal mb-1">帳號</label>
            <input
              className="w-full rounded-lg border border-blush px-3 py-2 text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-charcoal mb-1">密碼</label>
            <input
              className="w-full rounded-lg border border-blush px-3 py-2 text-sm"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-rose text-white py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? '登入中...' : '登入後台'}
          </button>
        </form>
      </div>
    </div>
  )
}
