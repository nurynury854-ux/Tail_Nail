export type ServiceCategory = 'hand' | 'foot'
export type ServiceType = 'main' | 'addon'

export interface Branch {
  id: string
  name: string
  address: string
  staff_count: number
  phone?: string
  image_url?: string
  is_active?: boolean
}

export interface Service {
  id: string
  name: string
  service_type: ServiceType
  is_addon: boolean
  is_active: boolean
  duration_minutes?: number
  price: number
  description?: string
  section?: 'hand' | 'feet'
  is_combo?: boolean
}

export interface ServiceDuration {
  id?: string
  stylist_id: string
  service_id: string
  category: ServiceCategory
  duration_minutes: number
  duration_min_minutes?: number | null
  duration_max_minutes?: number | null
  duration_note?: string | null
  is_pending: boolean
}

export interface Stylist {
  id: string
  branch_id: string
  name: string
  bio?: string
  is_active: boolean
}

export interface BranchWorkingHours {
  branch_id: string
  monday_open?: string | null
  monday_close?: string | null
  tuesday_open?: string | null
  tuesday_close?: string | null
  wednesday_open?: string | null
  wednesday_close?: string | null
  thursday_open?: string | null
  thursday_close?: string | null
  friday_open?: string | null
  friday_close?: string | null
  saturday_open?: string | null
  saturday_close?: string | null
  sunday_open?: string | null
  sunday_close?: string | null
}

export interface StylistWeeklyHours {
  id: string
  stylist_id: string
  day_of_week: number
  start_time?: string | null
  end_time?: string | null
  is_working: boolean
}

export interface BranchDayOverride {
  id: string
  branch_id: string
  date: string
  open_time?: string | null
  close_time?: string | null
  is_closed: boolean
  reason?: string | null
}

export interface StylistDayOverride {
  id: string
  stylist_id: string
  date: string
  start_time?: string | null
  end_time?: string | null
  is_off: boolean
  reason?: string | null
}

export interface SelectedServiceItem {
  service_id: string
  service_name?: string
  service_type: ServiceType
  category: ServiceCategory
  duration_minutes: number
  is_pending?: boolean
}

export interface Booking {
  id: string
  branch_id: string
  service_id?: string | null
  stylist_id?: string | null
  customer_name: string
  line_id: string
  phone?: string | null
  selected_services?: SelectedServiceItem[]
  category?: ServiceCategory | null
  total_duration?: number
  date: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  note?: string | null
  cancel_reason?: string | null
  line_notification_failed?: boolean
  created_at?: string
  branches?: Branch
  services?: Service
  stylists?: Stylist
}

export interface TimeSlot {
  time: string
  available: boolean
  bookingsCount: number
  availableStylists?: number
  stylistIds?: string[]
}

export interface BookingFormData {
  branch_id: string
  stylist_id?: string | null
  selected_services: SelectedServiceItem[]
  category: ServiceCategory
  date: string
  start_time: string
  customer_name: string
  line_id: string
  phone: string
  note?: string
}

export const BRANCHES: Branch[] = [
  {
    id: '1',
    name: '內壢店',
    address: '桃園市內壢區',
    staff_count: 2,
    phone: '03-123-4567',
    image_url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&auto=format&fit=crop',
    is_active: true,
  },
  {
    id: '2',
    name: '中壢店',
    address: '桃園市中壢區',
    staff_count: 2,
    phone: '03-234-5678',
    image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop',
    is_active: true,
  },
  {
    id: '3',
    name: '中原店',
    address: '桃園市中壢區中原大學周邊',
    staff_count: 4,
    phone: '03-345-6789',
    image_url: 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=800&auto=format&fit=crop',
    is_active: true,
  },
]

export const SERVICES: Service[] = [
  { id: 'svc-main-solid', name: '單色', service_type: 'main', is_addon: false, is_active: true, price: 0 },
  { id: 'svc-main-cat-eye', name: '貓眼', service_type: 'main', is_addon: false, is_active: true, price: 0 },
  { id: 'svc-main-gradient', name: '漸層', service_type: 'main', is_addon: false, is_active: true, price: 0 },
  { id: 'svc-main-french', name: '法式', service_type: 'main', is_addon: false, is_active: true, price: 0 },
  { id: 'svc-main-mirror', name: '鏡面', service_type: 'main', is_addon: false, is_active: true, price: 0 },
  { id: 'svc-main-store-style', name: '店內款式', service_type: 'main', is_addon: false, is_active: true, price: 0 },
  { id: 'svc-main-custom-style', name: '自帶圖款式', service_type: 'main', is_addon: false, is_active: true, price: 0 },
  { id: 'svc-addon-remove', name: '卸甲', service_type: 'addon', is_addon: true, is_active: true, price: 0 },
  { id: 'svc-addon-care', name: '保養＊', service_type: 'addon', is_addon: true, is_active: true, price: 0 },
  { id: 'svc-addon-shape', name: '純修甲＊', service_type: 'addon', is_addon: true, is_active: true, price: 0 },
  { id: 'svc-addon-thicken', name: '加厚', service_type: 'addon', is_addon: true, is_active: true, price: 0 },
  { id: 'svc-addon-extension', name: '延甲', service_type: 'addon', is_addon: true, is_active: true, duration_minutes: 60, price: 0 },
  { id: 'svc-addon-repair', name: '補甲', service_type: 'addon', is_addon: true, is_active: true, duration_minutes: 40, price: 0 },
]
