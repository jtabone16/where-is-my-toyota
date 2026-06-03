import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Where's My Yota?",
  description: "Track your Toyota order status without bugging your salesperson.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
