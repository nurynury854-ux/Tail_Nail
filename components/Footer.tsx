import Link from 'next/link'
import { MapPin, Phone, Clock, Instagram, Facebook, Sparkles } from 'lucide-react'

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
              Premium nail care with artistic excellence. Where beauty meets precision.
            </p>
            <div className="flex gap-3">
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-rose transition-colors flex items-center justify-center"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-rose transition-colors flex items-center justify-center"
              >
                <Facebook className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Branches */}
          <div>
            <h3 className="font-playfair text-white text-lg mb-4">Our Branches</h3>
            <div className="space-y-3 text-sm">
              {[
                { name: 'Neili Branch', addr: 'Neili District, Taoyuan', phone: '03-123-4567' },
                { name: 'Zhongli Branch', addr: 'Zhongli District, Taoyuan', phone: '03-234-5678' },
                { name: 'CYCU Branch', addr: 'Near CYCU, Taoyuan', phone: '03-345-6789' },
              ].map((b) => (
                <div key={b.name} className="group">
                  <p className="font-semibold text-white/90 group-hover:text-rose-light transition-colors text-xs uppercase tracking-wide mb-0.5">
                    {b.name}
                  </p>
                  <p className="text-white/50 text-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {b.addr}
                  </p>
                  <p className="text-white/50 text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3 flex-shrink-0" /> {b.phone}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Hours */}
          <div>
            <h3 className="font-playfair text-white text-lg mb-4">Hours</h3>
            <div className="space-y-2 text-sm">
              {[
                { day: 'Mon – Fri', hours: '10:00 – 20:00' },
                { day: 'Saturday', hours: '10:00 – 18:00' },
                { day: 'Sunday', hours: 'Closed' },
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
            <h3 className="font-playfair text-white text-lg mb-4">Booking</h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: '/booking', label: 'Book an Appointment' },
                { href: '/admin', label: 'Staff Dashboard' },
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
          <p>© {new Date().getFullYear()} Ttail Nail. All rights reserved.</p>
          <p>Built with ♡ for beautiful nails</p>
        </div>
      </div>
    </footer>
  )
}
