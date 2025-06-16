// src/components/layout/main-layout.tsx (Updated with Image Library Button)
'use client'

import React, { useState } from 'react'
import { EnhancedDirectoryTree } from '../file-tree/directory-tree'
import { EditorArea } from '../editor/editor-area'
import { ThemeToggle } from '../theme/theme-toggle'
import { ImagePicker } from '../editor/image-picker'
import { useTheme } from '../theme/theme-provider'
import { FileText, Users, Zap, FolderTree, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function MainLayout() {
  const { actualTheme } = useTheme()
  const [showImageLibrary, setShowImageLibrary] = useState(false)

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
          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            {/* File Tree Feature */}
            <div className="flex items-center gap-1 border rounded-md px-2 py-1">
              <FolderTree className="h-3 w-3 text-blue-500" />
              <span className="text-xs">Drag & Drop</span>
            </div>
            
            {/* Asset Management Feature */}
            <div className="flex items-center gap-1 border rounded-md px-2 py-1">
              <Images className="h-3 w-3 text-green-500" />
              <span className="text-xs">Asset Library</span>
            </div>
            
            {/* Status */}
            <div className="flex items-center gap-2 border rounded-md px-2 py-1">
              <div className={`w-2 h-2 rounded-full ${actualTheme === 'dark' ? 'bg-purple-500' : 'bg-blue-500'}`} />
              <span>Ready</span>
              <span className="text-xs opacity-75">• {actualTheme} mode</span>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Collaborative</span>
          </div>

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
          
          <ThemeToggle 
            showLabel={false}
            variant="outline"
            size="sm"
          />
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden">
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
    </div>
  )
}