'use client'

import { useEditorStore } from '@/lib/stores/editor-store'
import { cn } from '@/lib/utils'

export function SaveStatus() {
  const { saveStatus } = useEditorStore()

  const statusConfig = {
    saved: {
      label: 'Saved',
      className: 'bg-green-500/10 text-green-500',
    },
    saving: {
      label: 'Saving...',
      className: 'bg-orange-500/10 text-orange-500 animate-pulse',
    },
    unsaved: {
      label: 'Unsaved',
      className: 'bg-red-500/10 text-red-500',
    },
  }

  const config = statusConfig[saveStatus]

  return (
    <div
      className={cn(
        'absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-medium',
        config.className
      )}
    >
      {config.label}
    </div>
  )
} 