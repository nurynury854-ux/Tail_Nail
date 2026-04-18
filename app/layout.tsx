import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Lumière Nails | Premium Nail Salon in Taoyuan',
  description:
    'Book your nail appointment at Lumière Nails. Three branches in Neili, Zhongli, and CYCU. Expert nail technicians, premium services.',
  keywords: 'nail salon, manicure, gel nails, nail art, Taoyuan, Neili, Zhongli, CYCU',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
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
