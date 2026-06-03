import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Where Is My Toyota?",
  description: "Track your Toyota order status without harassing your salesperson.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
