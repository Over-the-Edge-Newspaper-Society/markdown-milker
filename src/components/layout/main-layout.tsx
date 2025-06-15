'use client'

import React from 'react'
import { DirectoryTree } from '../file-tree/directory-tree'
import { EditorArea } from '../editor/editor-area'

export function MainLayout() {
  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b px-4 py-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Markdown Editor</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Ready</span>
        </div>
      </header>
      
      <div className="flex-1 flex">
        <div className="w-64 h-full border-r">
          <DirectoryTree />
        </div>
        
        <div className="flex-1">
          <EditorArea />
        </div>
      </div>
    </div>
  )
}