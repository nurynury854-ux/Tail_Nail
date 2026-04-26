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
      <body className="font-nunito text-charcoal antialiased relative overflow-x-hidden">
        <div aria-hidden="true" className="site-edge-top" />
        <div aria-hidden="true" className="site-edge-bottom" />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: 'Noto Sans TC, sans-serif',
              background: '#FAF7F2',
              color: '#3D2E26',
              border: '1px solid #DDD5C8',
              borderRadius: '16px',
              boxShadow: '0 8px 24px rgba(61,46,38,0.08)',
            },
            success: {
              iconTheme: {
                primary: '#C8849A',
                secondary: '#FAF7F2',
              },
            },
          }}
        />
        <Navbar />
        <main className="site-shell min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
