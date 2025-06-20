import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { Header } from "@/components/layout/header"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "Solve Intelligence - AI Patent Platform",
    template: "%s | Solve Intelligence",
  },
  description: "Revolutionary AI-powered patent management, invention harvesting, and portfolio analysis platform for patent attorneys and legal professionals.",
  keywords: [
    "patent",
    "AI",
    "intellectual property",
    "patent attorney",
    "patent drafting",
    "prior art search",
    "invention analysis",
    "patent portfolio",
    "legal tech",
  ],
  authors: [{ name: "Solve Intelligence" }],
  creator: "Solve Intelligence",
  publisher: "Solve Intelligence",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: { url: '/favicon.svg', type: 'image/svg+xml' },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Solve Intelligence - AI Patent Platform",
    description: "Revolutionary AI-powered patent management platform",
    siteName: "Solve Intelligence",
  },
  twitter: {
    card: "summary_large_image",
    title: "Solve Intelligence - AI Patent Platform",
    description: "Revolutionary AI-powered patent management platform",
    creator: "@solveintelligence",
  },
  robots: {
    index: false, // Private B2B app
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <Header />
          <main className="min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}