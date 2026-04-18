# 💅 Lumière Nails — Booking System

A booking-focused nail salon demo built with **Next.js 14**, **Tailwind CSS**, and **Supabase**.

![Preview](https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200&h=400&auto=format&fit=crop)

---

## ✨ Features

- **Booking-First Experience** — Root route redirects directly to booking flow
- **Multi-Step Booking Flow** — Branch → Service → Date → Time → Details → Confirmation
- **Real-Time Slot Availability** — Checks existing bookings and respects staff capacity
- **Multi-Staff Logic** — Allows concurrent bookings up to staff count per branch
- **5-Minute Buffer** — Automatic buffer between bookings
- **Admin Dashboard** — View, filter, cancel, complete, and manually add bookings
- **LINE Notification Simulation** — Console-logged LINE messages (ready for real integration)
- **Mobile-First Design** — Fully responsive on all screen sizes
- **3 Branches** — Neili, Zhongli, and CYCU

---

## 🏗 Project Structure

```
nail-salon/
├── app/
│   ├── layout.tsx          # Root layout (Navbar + Footer)
│   ├── page.tsx            # Redirects to /booking
│   ├── booking/page.tsx    # Multi-step booking flow ⭐
│   ├── admin/page.tsx      # Admin dashboard
│   └── api/
│       ├── bookings/route.ts         # GET all, POST new booking
│       ├── bookings/[id]/route.ts    # PATCH cancel/complete, DELETE
│       └── slots/route.ts            # GET available time slots
├── components/
│   ├── Navbar.tsx
│   └── Footer.tsx
├── lib/
│   ├── types.ts            # TypeScript types + static data
│   ├── supabase.ts         # Supabase client
│   └── bookingUtils.ts     # Slot generation, time math, utilities
└── supabase/
    ├── schema.sql          # DB schema + RLS policies
    └── seed.sql            # Demo bookings data
```

---

## 🚀 Setup & Deployment

### 1. Clone & Install

```bash
git clone <repo-url>
cd nail-salon
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Open the **SQL Editor**
3. Run `supabase/schema.sql` first
4. Then run `supabase/seed.sql` for demo data
5. Copy your **Project URL** and **Anon Key** from Settings → API

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For admin operations
```

### 4. Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

### 5. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add the same environment variables in Vercel's project settings.

---

## 📅 Booking Logic

### Working Hours
| Day | Hours |
|-----|-------|
| Mon–Fri | 10:00 – 20:00 |
| Saturday | 10:00 – 18:00 |
| Sunday | **Closed** |

### Time Slot Generation
- Slots are generated hourly (10:00, 11:00, 12:00...)
- A slot is available if: `service duration + 5 min buffer` fits before closing time
- A slot is **blocked** if: the number of overlapping confirmed bookings ≥ branch staff count

### Multi-Staff Concurrency Example
```
Neili Branch (2 staff):
  10:00 — Alice (Gel Manicure, 120min)   → slot 1 booked
  10:00 — Betty (Basic Manicure, 60min)  → slot 2 booked
  10:00 — [Third person tries to book]   → BLOCKED (full)
```

---

## 🗄 Database Schema

```sql
branches   (id, name, address, staff_count, phone, image_url)
services   (id, name, duration_minutes, price, description, category)
bookings   (id, branch_id, service_id, customer_name, line_id, phone,
            date, start_time, end_time, status)
```

---

## 📱 LINE Integration (Future)

The `sendLineMessage()` function in `lib/bookingUtils.ts` currently logs to console.
To integrate with the real LINE Messaging API:

```typescript
// Replace the console.log with:
await fetch('https://api.line.me/v2/bot/message/push', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: lineUserId,
    messages: [{ type: 'text', text: message }],
  }),
})
```

### Webhook endpoint (for showcase)

This project now includes:

- `POST /api/line/webhook`

It verifies `x-line-signature` using `LINE_CHANNEL_SECRET`, then logs incoming events to server logs.

Set your LINE Developers webhook URL to:

`https://<your-domain>/api/line/webhook`

### Booking confirmation push message

`POST /api/bookings` now attempts to send a LINE push message.

- If `line_id` is a real LINE userId (`U...`), it sends to that userId.
- If `line_id` is not a `U...` userId (e.g. `@handle`), push is skipped to avoid sending to the wrong user.

---

## 🎨 Design System

| Token | Value |
|-------|-------|
| Primary (Rose) | `#C0737A` |
| Blush | `#FAF0F0` |
| Charcoal | `#2D1F25` |
| Champagne | `#F7E8D4` |
| Font Headings | Playfair Display |
| Font Body | Nunito |

---

## 📋 Pages

| Route | Description |
|-------|-------------|
| `/` | Redirects to `/booking` |
| `/booking` | Multi-step booking flow |
| `/admin` | Staff dashboard (no auth — demo only) |

---

## ⚠️ Demo Notes

- The `/admin` route has **no authentication** (demo purposes only)
- Add auth (e.g., Supabase Auth, NextAuth) before production use
- The LINE notification is simulated — check browser console for messages
- Booking IDs fall back to a demo format (`DEMO-XXXXX`) if Supabase is not connected
