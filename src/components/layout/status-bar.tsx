import React from 'react'
import { GitStatus } from './git-status'

export function StatusBar() {
  return (
    <div className="h-6 border-t px-4 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center space-x-4">
        <span>Ln 1, Col 1</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
      </div>
      <GitStatus />
    </div>
  )
} 