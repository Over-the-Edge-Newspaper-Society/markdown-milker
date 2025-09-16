// src/components/ui/toaster.tsx
'use client'

import { useEffect, useState } from 'react'
import { subscribe, type ToastMessage } from './use-toast'

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    return subscribe((msg) => {
      setToasts((prev) => [...prev, msg])
      const timeout = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id))
      }, msg.duration || 3000)
      return () => clearTimeout(timeout)
    })
  }, [])

  const color = (v?: string) => {
    switch (v) {
      case 'success':
        return 'border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200'
      case 'error':
        return 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
      case 'warning':
        return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
      default:
        return 'border-border bg-background text-foreground'
    }
  }

  return (
    <div className="fixed top-3 right-3 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id}
          className={`min-w-[220px] max-w-[360px] border rounded-md shadow-sm px-3 py-2 ${color(t.variant)}`}
        >
          {t.title && <div className="font-medium text-sm">{t.title}</div>}
          {t.description && <div className="text-xs opacity-80 mt-0.5">{t.description}</div>}
        </div>
      ))}
    </div>
  )
}

