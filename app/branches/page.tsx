import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Phone, Clock, Users, ArrowRight, Star } from 'lucide-react'
import { BRANCHES } from '@/lib/types'

type BranchDetail = (typeof BRANCHES)[number] & {
  hours: string
  features: string[]
  highlight: string
  badge?: string
}

const branchDetails: BranchDetail[] = [
  {
    ...BRANCHES[0],
    hours: 'Mon–Fri 10:00–20:00 | Sat 10:00–18:00',
    features: ['2 Nail Technicians', 'Walk-ins Welcome', 'Online Booking'],
    highlight: 'Most accessible branch with convenient parking',
  },
  {
    ...BRANCHES[1],
    hours: 'Mon–Fri 10:00–20:00 | Sat 10:00–18:00',
    features: ['3 Nail Technicians', 'Walk-ins Welcome', 'Online Booking'],
    highlight: 'Our largest branch with the shortest wait times',
    badge: 'Most Popular',
  },
  {
    ...BRANCHES[2],
    hours: 'Mon–Fri 10:00–20:00 | Sat 10:00–18:00',
    features: ['2 Nail Technicians', 'Student Friendly', 'Online Booking'],
    highlight: 'Perfect for CYCU students — steps from campus',
  },
]

export default function BranchesPage() {
  return (
    <div className="min-h-screen bg-cream pt-16">
      {/* Header */}
      <div className="bg-hero-gradient relative overflow-hidden py-24">
        <div className="absolute inset-0 hero-pattern opacity-20" />
        <div className="relative z-10 text-center px-4">
          <p className="text-rose-light text-sm font-semibold uppercase tracking-widest mb-3">Locations</p>
          <h1 className="font-playfair text-5xl md:text-6xl text-white font-bold mb-4">
            Our <span className="italic font-light">Branches</span>
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Three convenient locations across Taoyuan. Find the one closest to you.
          </p>
        </div>
      </div>

      {/* Hours Summary Banner */}
      <div className="bg-white border-b border-blush">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-warmgray">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose" />
              <span><strong className="text-charcoal">Mon–Fri:</strong> 10:00 – 20:00</span>
            </div>
            <div className="hidden sm:block w-1 h-1 bg-rose-light rounded-full" />
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose" />
              <span><strong className="text-charcoal">Saturday:</strong> 10:00 – 18:00</span>
            </div>
            <div className="hidden sm:block w-1 h-1 bg-rose-light rounded-full" />
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 text-center text-rose font-bold">✕</span>
              <span><strong className="text-charcoal">Sunday:</strong> Closed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Branch Cards */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="space-y-8">
          {branchDetails.map((branch, idx) => (
            <div
              key={branch.id}
              className={`bg-white rounded-3xl overflow-hidden shadow-card hover:shadow-medium transition-all duration-300 ${
                branch.badge ? 'ring-2 ring-rose ring-offset-2' : ''
              }`}
            >
              {branch.badge && (
                <div className="bg-rose text-white text-xs font-bold uppercase tracking-widest text-center py-2">
                  ⭐ {branch.badge}
                </div>
              )}
              <div className={`flex flex-col ${idx % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                {/* Image */}
                <div className="relative md:w-2/5 h-64 md:h-auto flex-shrink-0">
                  <Image
                    src={branch.image_url!}
                    alt={branch.name}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-charcoal/30 to-transparent" />
                </div>

                {/* Content */}
                <div className="flex-1 p-8 md:p-10">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h2 className="font-playfair text-3xl text-charcoal font-bold">{branch.name}</h2>
                    <div className="flex gap-0.5 mt-1">
                      {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-rose fill-current" />)}
                    </div>
                  </div>

                  <p className="text-rose text-sm font-medium mb-4 italic">{branch.highlight}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-sm">
                    <div className="flex items-start gap-2 text-warmgray">
                      <MapPin className="w-4 h-4 text-rose mt-0.5 flex-shrink-0" />
                      {branch.address}
                    </div>
                    <div className="flex items-center gap-2 text-warmgray">
                      <Phone className="w-4 h-4 text-rose flex-shrink-0" />
                      {branch.phone}
                    </div>
                    <div className="flex items-start gap-2 text-warmgray">
                      <Clock className="w-4 h-4 text-rose mt-0.5 flex-shrink-0" />
                      {branch.hours}
                    </div>
                    <div className="flex items-center gap-2 text-warmgray">
                      <Users className="w-4 h-4 text-rose flex-shrink-0" />
                      {branch.staff_count} Nail Technicians
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-8">
                    {branch.features.map((f) => (
                      <span
                        key={f}
                        className="bg-blush text-rose text-xs font-semibold px-3 py-1 rounded-full"
                      >
                        {f}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href={`/booking?branch=${branch.id}`}
                      className="flex-1 bg-rose text-white text-center py-3.5 rounded-xl font-semibold hover:bg-rose-dark transition-colors flex items-center justify-center gap-2 shadow-soft"
                    >
                      Book at {branch.name} <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a
                      href={`tel:${branch.phone}`}
                      className="flex-shrink-0 border-2 border-blush text-warmgray px-6 py-3.5 rounded-xl font-medium hover:border-rose hover:text-rose transition-colors text-center flex items-center justify-center gap-2"
                    >
                      <Phone className="w-4 h-4" /> Call
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* All Branches Book CTA */}
        <div className="mt-16 text-center bg-rose-gradient rounded-3xl p-12">
          <h2 className="font-playfair text-3xl text-charcoal font-bold mb-4">
            Not sure which branch?
          </h2>
          <p className="text-warmgray mb-8 max-w-md mx-auto">
            You can choose your preferred branch during the booking process. We&apos;ll show you available times for each.
          </p>
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 bg-rose text-white px-8 py-4 rounded-full font-semibold hover:bg-rose-dark transition-colors shadow-soft"
          >
            Start Booking <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
