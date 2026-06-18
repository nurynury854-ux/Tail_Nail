'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { CheckoutSessionProvider, ROLE_LABELS, useCheckoutSession } from '@/components/checkout/session'

function NavBar() {
  const { session } = useCheckoutSession()
  const pathname = usePathname()

  if (!session || pathname === '/checkout/login') return null

  const links: Array<{ href: string; label: string; roles: string[] }> = [
    { href: '/checkout', label: '總覽', roles: ['owner', 'manager', 'stylist'] },
    { href: '/checkout/orders', label: '結帳', roles: ['owner', 'manager', 'stylist'] },
    { href: '/checkout/calendar', label: '行事曆', roles: ['owner', 'manager', 'stylist'] },
    { href: '/checkout/reports', label: '報表', roles: ['owner', 'manager'] },
    { href: '/checkout/reconcile', label: '對帳', roles: ['owner', 'manager'] },
    { href: '/checkout/cleaning', label: '清潔', roles: ['owner', 'manager', 'stylist'] },
    { href: '/checkout/messages', label: '留言板', roles: ['owner', 'manager'] },
    { href: '/checkout/bonuses', label: '獎金', roles: ['owner'] },
    { href: '/checkout/prices', label: '價格', roles: ['owner'] },
    { href: '/checkout/logs', label: '修改記錄', roles: ['owner', 'manager'] },
    { href: '/checkout/accounts', label: '帳號管理', roles: ['owner'] },
  ].filter((l) => l.roles.includes(session.role))

  const logout = async () => {
    await fetch('/api/checkout/logout', { method: 'POST' })
    // Hard navigation so the session provider fully resets.
    window.location.assign('/checkout/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-blush">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
        <span className="font-playfair text-lg text-charcoal">結帳系統</span>
        <nav className="flex items-center gap-1 flex-wrap text-sm">
          {links.map((l) => {
            const active = pathname === l.href
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-full transition ${
                  active ? 'bg-rose text-white' : 'text-charcoal hover:bg-blush'
                }`}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-warmgray">
          <span>
            {session.displayName}・{ROLE_LABELS[session.role]}
          </span>
          <button onClick={logout} className="inline-flex items-center gap-1 hover:text-rose-dark">
            <LogOut size={15} /> 登出
          </button>
        </div>
      </div>
    </header>
  )
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <CheckoutSessionProvider>
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </div>
    </CheckoutSessionProvider>
  )
}
