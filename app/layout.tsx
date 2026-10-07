import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { SiteMenuProvider } from "@/components/gallery/site-menu-context"
import { MotionSettingsRoot } from "@/components/gallery/motion-settings"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Tangent UI",
  description: "React components with calm, physical motion, built on Base UI, Tailwind and Motion.",
}

// maximumScale stops iOS Safari zooming into inputs on focus; pinch-zoom still works there.
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-accent="neutral" suppressHydrationWarning className={cn(geist.variable, inter.variable, geistMono.variable)}>
      <body>
        <ThemeProvider>
          <MotionSettingsRoot>
            <SiteMenuProvider>{children}</SiteMenuProvider>
          </MotionSettingsRoot>
        </ThemeProvider>
      </body>
    </html>
  )
}
