'use client'

import { useEditorStore } from '@/lib/stores/editor-store'
import { cn } from '@/lib/utils'

const statusConfig = {
  saved: {
    label: 'Saved',
    className: 'bg-green-500/10 text-green-500 border-green-500/20'
  },
  saving: {
    label: 'Saving...',
    className: 'bg-orange-500/10 text-orange-500 border-orange-500/20 animate-pulse'
  },
  unsaved: {
    label: 'Unsaved',
    className: 'bg-red-500/10 text-red-500 border-red-500/20'
  }
} as const

export function SaveStatus() {
  const saveStatus = useEditorStore(state => state.saveStatus)
  const config = statusConfig[saveStatus]

  return (
    <div
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-full border whitespace-nowrap',
        config.className
      )}
    >
      {config.label}
    </div>
  )
} 