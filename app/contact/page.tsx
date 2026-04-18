import { MapPin, Phone, Clock, Mail, MessageCircle } from 'lucide-react'
import { BRANCHES } from '@/lib/types'
import Link from 'next/link'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-cream pt-16">
      {/* Header */}
      <div className="bg-hero-gradient relative overflow-hidden py-24">
        <div className="absolute inset-0 hero-pattern opacity-20" />
        <div className="relative z-10 text-center px-4">
          <p className="text-rose-light text-sm font-semibold uppercase tracking-widest mb-3">Get in Touch</p>
          <h1 className="font-playfair text-5xl md:text-6xl text-white font-bold mb-4">
            Contact <span className="italic font-light">Us</span>
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Questions? Feedback? We&apos;d love to hear from you.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Branch Contact Cards */}
          {BRANCHES.map((branch) => (
            <div key={branch.id} className="bg-white rounded-2xl p-7 shadow-card">
              <h3 className="font-playfair text-xl text-charcoal font-semibold mb-5">{branch.name}</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 text-warmgray">
                  <MapPin className="w-4 h-4 text-rose mt-0.5 flex-shrink-0" />
                  <span>{branch.address}</span>
                </div>
                <div className="flex items-center gap-3 text-warmgray">
                  <Phone className="w-4 h-4 text-rose flex-shrink-0" />
                  <a href={`tel:${branch.phone}`} className="hover:text-rose transition-colors">
                    {branch.phone}
                  </a>
                </div>
                <div className="flex items-start gap-3 text-warmgray">
                  <Clock className="w-4 h-4 text-rose mt-0.5 flex-shrink-0" />
                  <div>
                    <p>Mon–Fri: 10:00 – 20:00</p>
                    <p>Sat: 10:00 – 18:00</p>
                    <p>Sun: Closed</p>
                  </div>
                </div>
              </div>
              <Link
                href={`/booking?branch=${branch.id}`}
                className="block mt-6 text-center bg-blush text-rose py-2.5 rounded-xl text-sm font-semibold hover:bg-rose hover:text-white transition-colors"
              >
                Book Here
              </Link>
            </div>
          ))}
        </div>

        {/* General Info */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-8 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blush rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-rose" />
              </div>
              <h3 className="font-playfair text-xl font-semibold text-charcoal">LINE</h3>
            </div>
            <p className="text-warmgray text-sm mb-4 leading-relaxed">
              Reach us on LINE for quick responses. Our team typically replies within 1–2 hours during business hours.
            </p>
            <div className="bg-blush rounded-xl p-4 text-center">
              <p className="text-xs text-warmgray mb-1">LINE ID</p>
              <p className="font-bold text-rose text-lg">@lumierenails</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blush rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5 text-rose" />
              </div>
              <h3 className="font-playfair text-xl font-semibold text-charcoal">Email</h3>
            </div>
            <p className="text-warmgray text-sm mb-4 leading-relaxed">
              For general inquiries, partnerships, or feedback — send us an email and we&apos;ll respond within one business day.
            </p>
            <a
              href="mailto:hello@lumierenails.com"
              className="block bg-blush rounded-xl p-4 text-center hover:bg-rose-light transition-colors"
            >
              <p className="font-bold text-rose">hello@lumierenails.com</p>
            </a>
          </div>
        </div>

        {/* Book CTA */}
        <div className="mt-12 text-center">
          <p className="text-warmgray mb-4">The fastest way to reach us is to book online.</p>
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 bg-rose text-white px-8 py-4 rounded-full font-semibold hover:bg-rose-dark transition-colors shadow-soft"
          >
            Book an Appointment Now
          </Link>
        </div>
      </div>
    </div>
  )
}
