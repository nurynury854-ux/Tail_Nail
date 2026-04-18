import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Star, MapPin, Clock, Sparkles, Check } from 'lucide-react'

const services = [
  { name: 'Basic Manicure', price: 'NT$600', duration: '60 min', emoji: '💅' },
  { name: 'Gel Manicure', price: 'NT$1,200', duration: '120 min', emoji: '✨' },
  { name: 'Gel Removal', price: 'NT$300', duration: '30 min', emoji: '🌸' },
  { name: 'Nail Art Basic', price: 'NT$900', duration: '90 min', emoji: '🎨' },
  { name: 'Premium Nail Art', price: 'NT$1,800', duration: '150 min', emoji: '👑' },
]

const branches = [
  {
    name: 'Neili Branch',
    area: 'Neili District',
    staff: 2,
    image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&auto=format&fit=crop&q=80',
    id: '1',
  },
  {
    name: 'Zhongli Branch',
    area: 'Zhongli District',
    staff: 3,
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80',
    id: '2',
  },
  {
    name: 'CYCU Branch',
    area: 'Near CYCU',
    staff: 2,
    image: 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=600&auto=format&fit=crop&q=80',
    id: '3',
  },
]

const testimonials = [
  {
    name: 'Emily Chen',
    rating: 5,
    text: "Absolutely love this place! The nail technicians are so skilled and the results last for weeks. My go-to salon for gel manicures.",
    service: 'Gel Manicure',
    branch: 'Zhongli Branch',
  },
  {
    name: 'Sarah Lin',
    rating: 5,
    text: "The premium nail art service is incredible. They created exactly what I showed them and it came out even better than I imagined!",
    service: 'Premium Nail Art',
    branch: 'Neili Branch',
  },
  {
    name: 'Jessica Wang',
    rating: 5,
    text: "Super clean, professional, and the booking system is so convenient. I booked online and was taken right away at my appointment time.",
    service: 'Basic Manicure',
    branch: 'CYCU Branch',
  },
]

const galleryImages = [
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&auto=format&fit=crop&q=80&sat=-20',
  'https://images.unsplash.com/photo-1604655851887-d86c2ef3d8d7?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1604655855582-9a1ac44f38ef?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1604655851887-d86c2ef3d8d7?w=400&auto=format&fit=crop&q=80&hue=20',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&auto=format&fit=crop&q=80&sat=10',
]

export default function HomePage() {
  return (
    <div className="bg-cream">
      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="absolute inset-0 hero-pattern opacity-40" />

        {/* Decorative circles */}
        <div className="absolute top-1/4 -right-20 w-80 h-80 rounded-full bg-rose/20 blur-3xl" />
        <div className="absolute bottom-1/4 -left-20 w-64 h-64 rounded-full bg-mauve/20 blur-3xl" />

        {/* Floating badges */}
        <div className="absolute top-28 right-8 md:right-20 animate-float hidden sm:block">
          <div className="glass-card bg-white/10 text-white px-4 py-2 rounded-2xl text-sm font-medium border border-white/20 shadow-medium">
            ✨ 3 Locations in Taoyuan
          </div>
        </div>
        <div className="absolute bottom-28 left-8 md:left-20 animate-float hidden sm:block" style={{ animationDelay: '1.5s' }}>
          <div className="glass-card bg-white/10 text-white px-4 py-2 rounded-2xl text-sm font-medium border border-white/20">
            💅 Book in Minutes
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto pt-20">
          <div className="inline-flex items-center gap-2 bg-rose/20 text-rose-light px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-rose/30">
            <Sparkles className="w-4 h-4" />
            Premium Nail Salon in Taoyuan
          </div>

          <h1 className="font-playfair text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white font-bold leading-tight mb-6">
            Where Nails
            <br />
            <span className="italic font-light text-rose-light">Become Art</span>
          </h1>

          <p className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Expert nail technicians crafting beautiful, lasting results. Three convenient locations across Taoyuan — ready to book today.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/booking"
              className="group bg-rose text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-rose-dark transition-all duration-200 shadow-medium hover:shadow-soft flex items-center gap-2"
            >
              Book Your Appointment
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/services"
              className="text-white/80 hover:text-white px-8 py-4 rounded-full text-base font-medium border border-white/30 hover:border-white/50 hover:bg-white/10 transition-all duration-200"
            >
              View Services
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-6 max-w-md mx-auto">
            {[
              { value: '3', label: 'Branches' },
              { value: '7', label: 'Staff Members' },
              { value: '5★', label: 'Rating' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-playfair text-3xl text-white font-bold">{stat.value}</div>
                <div className="text-white/50 text-xs mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-5 h-8 rounded-full border-2 border-white/30 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 bg-white/60 rounded-full" />
          </div>
        </div>
      </section>

      {/* ── WHY US ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🎨',
                title: 'Expert Artists',
                desc: 'Our certified technicians are trained in the latest nail art techniques and trends.',
              },
              {
                icon: '✅',
                title: 'Premium Products',
                desc: 'We use only top-tier, long-lasting polishes and tools for beautiful, healthy nails.',
              },
              {
                icon: '📱',
                title: 'Easy Booking',
                desc: 'Book your appointment online in minutes. No phone calls needed.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="text-center p-8 rounded-2xl hover:bg-blush transition-colors duration-200 group"
              >
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-200 inline-block">
                  {item.icon}
                </div>
                <h3 className="font-playfair text-xl font-semibold text-charcoal mb-3">{item.title}</h3>
                <p className="text-warmgray text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-rose-gradient">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-rose text-sm font-semibold uppercase tracking-widest mb-2">Our Services</p>
            <h2 className="font-playfair text-4xl md:text-5xl text-charcoal font-bold">
              Crafted for <span className="italic text-rose">Every Style</span>
            </h2>
            <p className="text-warmgray mt-4 max-w-lg mx-auto">
              From classic manicures to elaborate nail art — we offer everything your nails deserve.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((svc, i) => (
              <div
                key={svc.name}
                className={`bg-white rounded-2xl p-6 shadow-card hover:shadow-soft transition-all duration-200 hover:-translate-y-1 ${
                  i === 4 ? 'sm:col-span-2 lg:col-span-1' : ''
                }`}
              >
                <div className="text-4xl mb-4">{svc.emoji}</div>
                <h3 className="font-playfair text-lg font-semibold text-charcoal mb-2">{svc.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-rose font-bold text-xl">{svc.price}</span>
                  <div className="flex items-center gap-1 text-warmgray text-sm">
                    <Clock className="w-3.5 h-3.5" />
                    {svc.duration}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-rose font-semibold hover:text-rose-dark transition-colors"
            >
              View all services & details
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── BRANCHES ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-rose text-sm font-semibold uppercase tracking-widest mb-2">Locations</p>
            <h2 className="font-playfair text-4xl md:text-5xl text-charcoal font-bold">
              Find Us <span className="italic text-rose">Near You</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {branches.map((branch) => (
              <div key={branch.name} className="group rounded-2xl overflow-hidden shadow-card hover:shadow-medium transition-all duration-300 hover:-translate-y-1">
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={branch.image}
                    alt={branch.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <p className="font-playfair text-lg font-semibold">{branch.name}</p>
                    <p className="text-white/80 text-sm flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {branch.area}
                    </p>
                  </div>
                </div>
                <div className="p-5 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-warmgray text-sm">
                      <span className="w-6 h-6 bg-blush rounded-full flex items-center justify-center text-xs font-bold text-rose">
                        {branch.staff}
                      </span>
                      Nail Technicians
                    </div>
                    <div className="flex text-rose text-xs">
                      {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                    </div>
                  </div>
                  <Link
                    href={`/booking?branch=${branch.id}`}
                    className="block text-center bg-blush text-rose font-semibold py-2.5 rounded-xl hover:bg-rose hover:text-white transition-all duration-200 text-sm"
                  >
                    Book at This Branch
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blush">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-rose text-sm font-semibold uppercase tracking-widest mb-2">Portfolio</p>
            <h2 className="font-playfair text-4xl md:text-5xl text-charcoal font-bold">
              Our <span className="italic text-rose">Artistry</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {galleryImages.map((img, i) => (
              <div key={i} className={`relative overflow-hidden rounded-2xl ${i === 0 ? 'row-span-2' : ''}`} style={{ height: i === 0 ? '320px' : '152px' }}>
                <Image
                  src={img}
                  alt={`Nail art ${i + 1}`}
                  fill
                  className="object-cover hover:scale-110 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 bg-rose text-white px-8 py-4 rounded-full font-semibold hover:bg-rose-dark transition-colors shadow-soft"
            >
              Book Your Look <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-rose text-sm font-semibold uppercase tracking-widest mb-2">Reviews</p>
            <h2 className="font-playfair text-4xl md:text-5xl text-charcoal font-bold">
              What Our Clients <span className="italic text-rose">Say</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-cream rounded-2xl p-7 shadow-card relative">
                <div className="text-rose text-4xl font-playfair absolute -top-3 left-6 leading-none">&quot;</div>
                <div className="flex gap-0.5 mb-4 mt-2">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-rose fill-current" />
                  ))}
                </div>
                <p className="text-warmgray text-sm leading-relaxed mb-5">{t.text}</p>
                <div className="border-t border-blush pt-4">
                  <p className="font-semibold text-charcoal">{t.name}</p>
                  <p className="text-rose text-xs mt-0.5">
                    {t.service} · {t.branch}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern opacity-20" />
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="font-playfair text-4xl md:text-5xl text-white font-bold mb-6">
            Ready for Beautiful Nails?
          </h2>
            <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">
              Book your appointment online in under 2 minutes. Choose your branch, service, and time — we&apos;ll take care of the rest.
            </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/booking"
                className="bg-white text-rose px-8 py-4 rounded-full font-bold hover:bg-cream transition-colors shadow-medium"
              >
                Book Now — It&apos;s Free
              </Link>
            <Link
              href="/branches"
              className="text-white border border-white/40 px-8 py-4 rounded-full font-medium hover:bg-white/10 transition-colors"
            >
              Find a Branch
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-white/60 text-sm">
            {['No deposit required', 'Easy cancellation', 'Fast online booking'].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-rose-light" /> {f}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
