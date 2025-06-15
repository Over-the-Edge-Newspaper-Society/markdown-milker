'use client'

import React from 'react'
import { DirectoryTree } from '../file-tree/directory-tree'
import { EditorArea } from '../editor/editor-area'
import { ThemeToggle } from '../theme/theme-toggle'
import { useTheme } from '../theme/theme-provider'
import { FileText, Users, Zap } from 'lucide-react'

export function MainLayout() {
  const { actualTheme } = useTheme()

  return (
    <div className="h-screen flex flex-col bg-background text-foreground transition-colors">
      <header className="border-b px-4 py-2 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <FileText className="h-6 w-6 text-primary" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                <Zap className="h-2 w-2 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-semibold">Markdown Editor</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Collaborative editing with real-time sync
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground border rounded-md px-2 py-1">
            <div className={`w-2 h-2 rounded-full ${actualTheme === 'dark' ? 'bg-purple-500' : 'bg-blue-500'}`} />
            <span>Ready</span>
            <span className="text-xs opacity-75">• {actualTheme} mode</span>
          </div>
          
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Collaborative</span>
          </div>
          
          <ThemeToggle 
            showLabel={false}
            variant="outline"
            size="sm"
          />
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 h-full border-r bg-muted/30">
          <DirectoryTree />
        </div>
        
        <div className="flex-1 bg-background">
          <EditorArea />
        </div>
      </div>
    </div>
  )
}