import Link from 'next/link'
import { Clock, ArrowRight, Sparkles } from 'lucide-react'
import { SERVICES, BRANCHES } from '@/lib/types'
import { formatPrice, formatDuration } from '@/lib/bookingUtils'

const categoryColors: Record<string, string> = {
  Manicure: 'bg-rose/10 text-rose',
  Gel: 'bg-mauve/10 text-mauve',
  Removal: 'bg-sage/20 text-sage',
  'Nail Art': 'bg-champagne/50 text-rose-dark',
}

const categoryDescriptions: Record<string, string> = {
  Manicure: 'Classic nail care for everyday elegance',
  Gel: 'Long-lasting, chip-resistant polish',
  Removal: 'Safe and gentle removal services',
  'Nail Art': 'Creative designs for every occasion',
}

export default function ServicesPage() {
  const categories = SERVICES.reduce<string[]>((acc, service) => {
    if (!service.category || acc.includes(service.category)) return acc
    acc.push(service.category)
    return acc
  }, [])

  return (
    <div className="min-h-screen bg-cream pt-16">
      {/* Header */}
      <div className="bg-hero-gradient relative overflow-hidden py-24">
        <div className="absolute inset-0 hero-pattern opacity-20" />
        <div className="relative z-10 text-center px-4">
          <p className="text-rose-light text-sm font-semibold uppercase tracking-widest mb-3">What We Offer</p>
          <h1 className="font-playfair text-5xl md:text-6xl text-white font-bold mb-4">
            Our <span className="italic font-light">Services</span>
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Premium nail care tailored to your style. Every service performed with precision and care.
          </p>
        </div>
      </div>

      {/* Services by Category */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {categories.map((cat) => {
          const catServices = SERVICES.filter((s) => s.category === cat)
          return (
            <div key={cat} className="mb-16">
              <div className="flex items-center gap-4 mb-8">
                <div className={`px-4 py-1.5 rounded-full text-sm font-semibold ${categoryColors[cat] || 'bg-blush text-rose'}`}>
                  {cat}
                </div>
                <p className="text-warmgray text-sm">{categoryDescriptions[cat]}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {catServices.map((svc) => (
                  <div
                    key={svc.id}
                    className="bg-white rounded-2xl p-7 shadow-card hover:shadow-soft transition-all duration-200 hover:-translate-y-0.5 flex gap-5"
                  >
                    <div className="flex-1">
                      <h3 className="font-playfair text-xl font-semibold text-charcoal mb-2">{svc.name}</h3>
                      <p className="text-warmgray text-sm leading-relaxed mb-4">{svc.description}</p>
                      <div className="flex items-center gap-4">
                        <span className="text-rose font-bold text-2xl">{formatPrice(svc.price)}</span>
                        <div className="flex items-center gap-1.5 text-warmgray text-sm">
                          <Clock className="w-4 h-4" />
                          {formatDuration(svc.duration_minutes)}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <Link
                        href={`/booking?service=${svc.id}`}
                        className="flex items-center gap-1 text-rose text-sm font-semibold hover:text-rose-dark transition-colors group"
                      >
                        Book
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* FAQ-style info */}
        <div className="bg-blush rounded-3xl p-8 md:p-12 mt-8">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-10 h-10 bg-rose rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-playfair text-2xl text-charcoal font-bold mb-2">Good to Know</h2>
              <p className="text-warmgray text-sm">A few things about our services and booking process.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                q: 'Do I need to make a reservation?',
                a: 'We strongly recommend booking ahead via our online system to secure your preferred time slot.',
              },
              {
                q: 'What if I need to cancel?',
                a: "No problem — cancel anytime before your appointment using your booking confirmation link.",
              },
              {
                q: 'Are products safe for sensitive nails?',
                a: 'Yes! We use high-quality, certified products and can accommodate sensitivities on request.',
              },
              {
                q: 'How long do gel nails last?',
                a: 'Gel manicures typically last 2–3 weeks without chipping when properly applied and cared for.',
              },
            ].map((item) => (
              <div key={item.q}>
                <p className="font-semibold text-charcoal mb-1.5 text-sm">{item.q}</p>
                <p className="text-warmgray text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Book CTA */}
        <div className="text-center mt-14">
          <h2 className="font-playfair text-3xl text-charcoal font-bold mb-4">
            Ready to book?
          </h2>
          <p className="text-warmgray mb-6">Choose your branch and schedule your appointment in minutes.</p>
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 bg-rose text-white px-8 py-4 rounded-full font-semibold hover:bg-rose-dark transition-colors shadow-soft"
          >
            Book an Appointment <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
