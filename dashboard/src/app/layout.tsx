import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Prometheus Vault — Autonomous DeFi Yield Optimizer',
  description: 'An autonomous agent that continuously optimizes DeFi yield on Solana using the OODA loop framework.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🜂</text></svg>',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-primary min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
