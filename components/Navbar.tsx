'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Sparkles } from 'lucide-react'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/branches', label: 'Branches' },
  { href: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const isHome = pathname === '/'

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || !isHome || open
          ? 'nav-blur bg-cream/90 shadow-soft border-b border-rose-light/30'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-rose flex items-center justify-center shadow-soft">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span
                className={`font-playfair text-xl font-semibold tracking-wide transition-colors ${
                  !scrolled && isHome && !open ? 'text-white' : 'text-charcoal'
                }`}
              >
                Lumière
              </span>
              <span
                className={`font-playfair text-xl font-light italic ml-1 transition-colors ${
                  !scrolled && isHome && !open ? 'text-rose-light' : 'text-rose'
                }`}
              >
                Nails
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium tracking-wide transition-all duration-200 relative group ${
                  !scrolled && isHome
                    ? 'text-white/90 hover:text-white'
                    : 'text-warmgray hover:text-charcoal'
                } ${pathname === link.href ? (!scrolled && isHome ? 'text-white' : 'text-charcoal') : ''}`}
              >
                {link.label}
                <span
                  className={`absolute -bottom-1 left-0 h-0.5 bg-rose transition-all duration-200 ${
                    pathname === link.href ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </Link>
            ))}
            <Link
              href="/booking"
              className="bg-rose text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-rose-dark transition-all duration-200 shadow-soft hover:shadow-medium"
            >
              Book Now
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen(!open)}
            className={`md:hidden p-2 rounded-lg transition-colors ${
              !scrolled && isHome && !open
                ? 'text-white hover:bg-white/10'
                : 'text-charcoal hover:bg-blush'
            }`}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {open && (
          <div className="md:hidden py-4 border-t border-rose-light/20">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'bg-blush text-rose font-semibold'
                      : 'text-warmgray hover:bg-blush hover:text-charcoal'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/booking"
                className="mt-3 mx-4 bg-rose text-white px-5 py-3 rounded-full text-sm font-semibold text-center hover:bg-rose-dark transition-colors shadow-soft"
              >
                ✨ Book Now
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
