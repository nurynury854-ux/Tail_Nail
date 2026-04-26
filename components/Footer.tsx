import Link from 'next/link'
import { MapPin, Clock, Instagram, Sparkles } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-charcoal text-white/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-rose flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-playfair text-xl text-white">
                Ttail <span className="italic text-rose-light font-light">Nail</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/60 mb-6">
              專業美甲服務，精緻呈現每一個細節。
            </p>
            <div className="flex gap-3">
              <a
                href="https://www.instagram.com/ttail_nail?igsh=MW5pYzBhdTF5ZHc5ZA%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-rose transition-colors flex items-center justify-center"
              >
                <Instagram className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Branches */}
          <div>
            <h3 className="font-playfair text-white text-lg mb-4">分店資訊</h3>
            <div className="space-y-3 text-sm">
              {[
                { name: '內壢店', addr: '桃園市內壢區' },
                { name: '中壢店', addr: '桃園市中壢區' },
                { name: '中原店', addr: '桃園市中壢區中原大學周邊' },
              ].map((b) => (
                <div key={b.name} className="group">
                  <p className="font-semibold text-white/90 group-hover:text-rose-light transition-colors text-xs tracking-wide mb-0.5">
                    {b.name}
                  </p>
                  <p className="text-white/50 text-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {b.addr}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Hours */}
          <div>
            <h3 className="font-playfair text-white text-lg mb-4">營業時間</h3>
            <div className="space-y-2 text-sm">
              {[
                { day: '每日', hours: '11:00 – 21:00' },
              ].map((h) => (
                <div key={h.day} className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 mt-0.5 text-rose-light flex-shrink-0" />
                  <div>
                    <span className="text-white/90 font-medium">{h.day}</span>
                    <span className="text-white/50 ml-2">{h.hours}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-playfair text-white text-lg mb-4">線上預約</h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: '/booking', label: '立即預約' },
                { href: '/admin', label: '店員後台' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-rose-light transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} Ttail Nail. 版權所有。</p>
          <p>為美麗而生 ♡</p>
        </div>
      </div>
    </footer>
  )
}
