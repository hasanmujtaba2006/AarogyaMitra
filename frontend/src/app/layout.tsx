import './globals.css'
import type { Metadata } from 'next'
import { LanguageProvider } from '@/context/LanguageContext'

export const metadata: Metadata = {
  title: 'AarogyaMitra: Multilingual Healthcare Kiosk',
  description: 'OPD Registration & Intelligent Voice Clinical Intake Kiosk',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}

