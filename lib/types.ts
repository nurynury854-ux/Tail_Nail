export interface Branch {
  id: string
  name: string
  address: string
  staff_count: number
  phone?: string
  image_url?: string
}

export interface Service {
  id: string
  name: string
  duration_minutes: number
  price: number
  description?: string
  category?: string
}

export interface Booking {
  id: string
  branch_id: string
  service_id: string
  customer_name: string
  line_id: string
  phone?: string
  date: string // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string // HH:MM
  status: 'confirmed' | 'cancelled' | 'completed'
  created_at?: string
  branches?: Branch
  services?: Service
}

export interface TimeSlot {
  time: string // HH:MM
  available: boolean
  bookingsCount: number
}

export interface BookingFormData {
  branch_id: string
  service_id: string
  date: string
  start_time: string
  customer_name: string
  line_id: string
  phone: string
}

// Static branch data (also seeded in DB)
export const BRANCHES: Branch[] = [
  {
    id: '1',
    name: 'Neili Branch',
    address: 'Neili District, Taoyuan City',
    staff_count: 2,
    phone: '03-123-4567',
    image_url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&auto=format&fit=crop',
  },
  {
    id: '2',
    name: 'Zhongli Branch',
    address: 'Zhongli District, Taoyuan City',
    staff_count: 3,
    phone: '03-234-5678',
    image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop',
  },
  {
    id: '3',
    name: 'CYCU Branch',
    address: 'Near Chung Yuan Christian University, Taoyuan',
    staff_count: 2,
    phone: '03-345-6789',
    image_url: 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=800&auto=format&fit=crop',
  },
]

// Static service data (also seeded in DB)
export const SERVICES: Service[] = [
  {
    id: '1',
    name: 'Basic Manicure',
    duration_minutes: 60,
    price: 600,
    description: 'Classic nail care including shaping, cuticle care, and polish application.',
    category: 'Manicure',
  },
  {
    id: '2',
    name: 'Gel Manicure',
    duration_minutes: 120,
    price: 1200,
    description: 'Long-lasting gel polish that stays chip-free for up to 3 weeks.',
    category: 'Gel',
  },
  {
    id: '3',
    name: 'Gel Removal',
    duration_minutes: 30,
    price: 300,
    description: 'Safe and gentle removal of existing gel polish.',
    category: 'Removal',
  },
  {
    id: '4',
    name: 'Nail Art Basic',
    duration_minutes: 90,
    price: 900,
    description: 'Creative nail art designs including patterns, gradients, and accents.',
    category: 'Nail Art',
  },
  {
    id: '5',
    name: 'Premium Nail Art',
    duration_minutes: 150,
    price: 1800,
    description: 'Elaborate custom nail art with gems, 3D elements, and intricate designs.',
    category: 'Nail Art',
  },
]
