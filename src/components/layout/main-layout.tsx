// src/components/layout/main-layout.tsx (Updated with GitHub Integration)
'use client'

import React, { useState, useEffect } from 'react'
import { EnhancedDirectoryTree } from '../file-tree/directory-tree'
import { EditorArea } from '../editor/editor-area'
import { ThemeToggle } from '../theme/theme-toggle'
import { ImagePicker } from '../editor/image-picker'
import { SettingsModal } from '../settings/SettingsModal'
import { GitHubSyncButtons } from '../github-sync/GitHubSyncButtons'
import { useTheme } from '../theme/theme-provider'
import { SettingsManager } from '@/lib/settings'
import { FileText, Zap, Images, Settings, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function MainLayout() {
  const { actualTheme } = useTheme()
  const [showImageLibrary, setShowImageLibrary] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)

  useEffect(() => {
    setIsConfigured(SettingsManager.isConfigured())
  }, [])

  const handleImageLibraryToggle = () => {
    setShowImageLibrary(true)
  }

  const handleImageSelect = (imagePath: string) => {
    console.log('📸 Image selected from header library:', imagePath)
    // Copy to clipboard for easy pasting
    navigator.clipboard.writeText(`![Image](${imagePath})`).then(() => {
      console.log('📋 Image markdown copied to clipboard')
    }).catch((err) => {
      console.warn('Failed to copy to clipboard:', err)
    })
  }

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
              <h1 className="text-lg font-semibold">Markdown Milker</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Collaborative editing with drag & drop and asset management
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* GitHub Integration Alert */}
          {!isConfigured && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1 text-sm">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-yellow-800">GitHub not configured</span>
              <Button 
                variant="link" 
                className="h-auto p-0 text-yellow-600 underline text-sm"
                onClick={() => setShowSettings(true)}
              >
                Setup
              </Button>
            </div>
          )}
          
          {/* GitHub Sync Buttons */}
          {isConfigured && <GitHubSyncButtons />}

          {/* Image Library Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleImageLibraryToggle}
            className="flex items-center gap-2"
            title="Open Image Library"
          >
            <Images className="h-4 w-4" />
            <span className="hidden sm:inline">Library</span>
          </Button>
          
          {/* Settings Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          
          <ThemeToggle 
            showLabel={false}
            variant="outline"
            size="sm"
          />
        </div>
      </header>
      
      <div className="flex-1 flex relative">
        <div className="w-64 h-full border-r bg-muted/30">
          <EnhancedDirectoryTree />
        </div>
        
        <div className="flex-1 bg-background">
          <EditorArea />
        </div>
      </div>

      {/* Global Image Library Dialog */}
      <ImagePicker
        onImageSelect={handleImageSelect}
        activeDir="docs"
        trigger={null}
        open={showImageLibrary}
        onOpenChange={setShowImageLibrary}
      />

      {/* Settings Modal */}
      <SettingsModal 
        open={showSettings} 
        onOpenChange={(open) => {
          setShowSettings(open);
          if (!open) {
            setIsConfigured(SettingsManager.isConfigured());
          }
        }} 
      />
    </div>
  )
}