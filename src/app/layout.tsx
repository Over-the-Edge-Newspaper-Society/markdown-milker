import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css' // Clean general app styles only
import { ThemeProvider } from '@/components/theme/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Markdown Milker',
  description: 'A modern Markdown editor built with Next.js and Milkdown',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          defaultTheme="system"
          storageKey="markdown-editor-theme"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}