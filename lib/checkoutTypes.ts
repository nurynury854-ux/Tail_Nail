// Shared types for the checkout / POS system.

export type CheckoutRole = 'owner' | 'manager' | 'stylist'
export type OrderStatus = 'draft' | 'submitted' | 'confirmed'
export type OrderSource = 'calendar' | 'manual'
export type PaymentMethod = 'cash' | 'transfer'
export type DiscountType = 'manual' | 'review_incentive'

export type EditLogAction =
  | 'create'
  | 'edit'
  | 'submit'
  | 'confirm'
  | 'blocked_edit_attempt'
  | 'delete'
  | 'actual_amount_adjust'

export interface Account {
  id: string
  username: string
  role: CheckoutRole
  branch_id?: string | null
  stylist_id?: string | null
  display_name: string
  subtitle?: string | null
  is_active: boolean
  created_at?: string
  created_by?: string | null
  updated_at?: string
  // never sent to the client:
  password_hash?: string
  password_salt?: string
}

// What the verified session cookie carries.
export interface CheckoutSession {
  accountId: string
  role: CheckoutRole
  branchId: string | null
  stylistId: string | null
  displayName: string
  username: string
}

export interface OrderItemInput {
  service_id?: string | null
  service_name: string
  unit_price: number
  quantity?: number
  discount?: number
  discount_type?: DiscountType | null
}

export interface OrderItem {
  id: string
  order_id: string
  service_id?: string | null
  price_key?: string | null
  service_name_snapshot: string
  category?: 'hand' | 'foot' | null
  unit_price: number
  quantity: number
  discount: number
  discount_type?: DiscountType | null
  unit_count?: number | null
  tier_index?: number | null
  accent_count?: number | null
  line_total: number
  created_at?: string
}

export interface CheckoutOrder {
  id: string
  branch_id_snapshot: string
  branch_name_snapshot: string
  stylist_id_snapshot?: string | null
  stylist_name_snapshot: string
  account_id_snapshot?: string | null
  booking_id?: string | null
  source: OrderSource
  customer_name?: string | null
  customer_phone?: string | null
  gross_amount: number
  discount_total: number
  revenue: number
  stylist_income: number
  income_rate: number
  payment_method?: PaymentMethod | null
  status: OrderStatus
  stylist_confirmed: boolean
  submitted_at?: string | null
  submitted_by?: string | null
  confirmed_at?: string | null
  confirmed_by?: string | null
  business_date: string
  created_at?: string
  updated_at?: string
  items?: OrderItem[]
}

export interface OrderEditLog {
  id: string
  order_id?: string | null
  order_id_text?: string | null
  branch_id_snapshot?: string | null
  actor_account_id?: string | null
  actor_name: string
  actor_role: string
  action: EditLogAction
  field_changes?: Array<{ field: string; old: unknown; new: unknown }> | null
  reason?: string | null
  created_at?: string
}

export interface ActualAmountAdjustment {
  id: string
  branch_id_snapshot: string
  business_date: string
  system_total: number
  actual_total: number
  difference: number
  reason: string
  account_id?: string | null
  account_name: string
  created_at?: string
}

export interface FixedBonus {
  id: string
  stylist_id_snapshot?: string | null
  stylist_name_snapshot?: string | null
  amount: number
  is_active: boolean
  effective_from?: string | null
  created_at?: string
}

export type BonusScope = 'stylist' | 'branch'

export interface PerformanceBonus {
  id: string
  scope: BonusScope
  stylist_id_snapshot?: string | null
  branch_id_snapshot?: string | null
  revenue_threshold: number
  bonus_amount: number
  is_active: boolean
  created_at?: string
}

export interface CleaningDuty {
  id: string
  branch_id: string
  duty_date: string
  stylist_id?: string | null
  stylist_name_snapshot?: string | null
  assigned_at?: string
}

export interface BoardMessage {
  id: string
  branch_id: string
  author_account_id?: string | null
  author_name: string
  author_role: string
  body: string
  created_at?: string
  deleted_at?: string | null
}

// The default stylist income share (业绩 = 50% of 营业额).
export const DEFAULT_INCOME_RATE = 0.5

// Flat NTD discount granted to customers who leave a positive review.
export const REVIEW_INCENTIVE_AMOUNT = 50
