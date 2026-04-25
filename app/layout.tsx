import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: '小尾巴美甲 Ttail Nail | 桃園美甲線上預約',
  description: '小尾巴美甲線上預約系統，支援內壢店、中壢店、中原店分店預約與 LINE 通知。',
  keywords: '小尾巴美甲, Ttail Nail, 桃園美甲, 內壢店, 中壢店, 中原店, 線上預約',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className="scroll-smooth">
      <body className="font-nunito bg-cream text-charcoal antialiased">
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: 'Nunito, sans-serif',
              background: '#FEFAF8',
              color: '#2D1F25',
              border: '1px solid #E8B4B8',
              borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(192,115,122,0.15)',
            },
            success: {
              iconTheme: {
                primary: '#C0737A',
                secondary: '#FEFAF8',
              },
            },
          }}
        />
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
