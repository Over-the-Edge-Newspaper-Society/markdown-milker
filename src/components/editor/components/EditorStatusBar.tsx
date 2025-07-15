// src/components/editor/components/EditorStatusBar.tsx
'use client'

import React from 'react'

interface EditorStatusBarProps {
  connectionStatus: string
  collaborators: number
  collaborative: boolean
  hasError: boolean
  errorMessage: string
  isLoading: boolean
  documentId: string
  saveCount?: number
  lastSaveTime?: Date | null
}

export function EditorStatusBar({
  connectionStatus,
  collaborators,
  collaborative,
  hasError,
  errorMessage,
  isLoading,
  documentId,
  saveCount = 0,
  lastSaveTime
}: EditorStatusBarProps) {
  const getStatusColor = () => {
    if (hasError) return 'bg-red-500'
    if (connectionStatus === 'synced') return 'bg-green-500'
    if (connectionStatus === 'solo') return 'bg-blue-500'
    if (connectionStatus === 'connected') return 'bg-blue-500'
    if (connectionStatus === 'connecting') return 'bg-yellow-500 animate-pulse'
    return 'bg-gray-500'
  }

  const getStatusText = () => {
    if (hasError) return `Error: ${errorMessage}`
    if (isLoading) return 'Loading...'
    if (connectionStatus === 'synced') return 'Collaborative Crepe'
    if (connectionStatus === 'solo') return 'Solo Crepe'
    return 'Connecting...'
  }

  return (
    <div className="flex items-center justify-between p-2 border-b bg-muted/30 text-sm backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()} transition-colors`} />
        <span className="font-medium">{getStatusText()}</span>
        
        {collaborative && collaborators > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-purple-600 dark:text-purple-400">•</span>
            <span className="text-purple-600 dark:text-purple-400">{collaborators} users</span>
          </div>
        )}
        
        {saveCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-green-600 dark:text-green-400 text-xs">•</span>
            <span className="text-green-600 dark:text-green-400 text-xs">{saveCount} saves</span>
          </div>
        )}
        
        {lastSaveTime && (
          <div className="flex items-center gap-1">
            <span className="text-blue-600 dark:text-blue-400 text-xs">•</span>
            <span className="text-blue-600 dark:text-blue-400 text-xs">{lastSaveTime.toLocaleTimeString()}</span>
          </div>
        )}
      </div>
      
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <span>{documentId}</span>
        <span>•</span>
        <span className={collaborative ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}>
          {collaborative ? 'Collaborative' : 'Solo'} Mode
        </span>
      </div>
    </div>
  )
}
