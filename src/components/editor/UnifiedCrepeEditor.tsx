// src/components/editor/UnifiedCrepeEditor.tsx (Updated with Fixed Toolbar)
'use client'

import { useRef, useState, useMemo, useEffect, useCallback } from 'react'
import { useCrepeEditor } from './hooks/useCrepeEditor'
import { useCollaboration } from './hooks/useCollaboration'
import { useContentSync } from './hooks/useContentSync'
import { useImageManagement } from './hooks/useImageManagement'
import { EditorStatusBar } from './components/EditorStatusBar'
import { ImagePicker, type ImagePickerRef } from './image-picker'
import { Button } from '@/components/ui/button'
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  Link, 
  List, 
  ListOrdered, 
  Quote, 
  Image,
  Heading1,
  Heading2,
  Heading3,
  Table,
  Minus
} from 'lucide-react'
import { commandsCtx } from '@milkdown/kit/core'

// Import Crepe core styles
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import '@milkdown/crepe/theme/frame-dark.css'

// Import our custom Crepe theme
import './crepe-editor.css'

interface UnifiedCrepeEditorProps {
  documentId: string
  initialContent?: string
  onChange?: (markdown: string) => void
  wsUrl?: string
  collaborative?: boolean
  onImageLibraryOpen?: () => void
}

// Fixed Toolbar Component
function FixedToolbar({ 
  builder, 
  onImageClick 
}: { 
  builder: any
  onImageClick: () => void 
}) {
  const handleCommand = useCallback((command: string) => {
    if (!builder) return
    
    try {
      builder.editor.action((ctx: any) => {
        const commands = ctx.get(commandsCtx)
        
        switch (command) {
          case 'bold':
            commands.call('ToggleStrong')
            break
          case 'italic':
            commands.call('ToggleEmphasis')
            break
          case 'strikethrough':
            commands.call('ToggleStrikethrough')
            break
          case 'code':
            commands.call('ToggleInlineCode')
            break
          case 'link':
            commands.call('ToggleLink')
            break
          case 'bulletList':
            commands.call('WrapInBulletList')
            break
          case 'orderedList':
            commands.call('WrapInOrderedList')
            break
          case 'blockquote':
            commands.call('WrapInBlockquote')
            break
          case 'h1':
            commands.call('TurnIntoHeading', { level: 1 })
            break
          case 'h2':
            commands.call('TurnIntoHeading', { level: 2 })
            break
          case 'h3':
            commands.call('TurnIntoHeading', { level: 3 })
            break
          case 'hr':
            commands.call('InsertHr')
            break
          case 'table':
            commands.call('InsertTable')
            break
          case 'image':
            onImageClick()
            break
        }
      })
    } catch (error) {
      console.warn('Command failed:', command, error)
    }
  }, [builder, onImageClick])

  const toolbarItems = [
    { icon: Bold, command: 'bold', label: 'Bold' },
    { icon: Italic, command: 'italic', label: 'Italic' },
    { icon: Strikethrough, command: 'strikethrough', label: 'Strikethrough' },
    { type: 'divider' },
    { icon: Heading1, command: 'h1', label: 'Heading 1' },
    { icon: Heading2, command: 'h2', label: 'Heading 2' },
    { icon: Heading3, command: 'h3', label: 'Heading 3' },
    { type: 'divider' },
    { icon: Code, command: 'code', label: 'Inline Code' },
    { icon: Link, command: 'link', label: 'Link' },
    { type: 'divider' },
    { icon: List, command: 'bulletList', label: 'Bullet List' },
    { icon: ListOrdered, command: 'orderedList', label: 'Numbered List' },
    { icon: Quote, command: 'blockquote', label: 'Quote' },
    { type: 'divider' },
    { icon: Table, command: 'table', label: 'Table' },
    { icon: Minus, command: 'hr', label: 'Horizontal Rule' },
    { icon: Image, command: 'image', label: 'Image' },
  ]

  return (
    <div className="fixed-toolbar flex items-center gap-1 p-2 bg-background border border-border rounded-lg shadow-md mb-4 sticky top-0 z-20 overflow-x-auto">
      {toolbarItems.map((item, index) => {
        if (item.type === 'divider') {
          return (
            <div
              key={`divider-${index}`}
              className="w-px h-6 bg-border mx-1 flex-shrink-0"
            />
          )
        }

        const Icon = item.icon!
        return (
          <Button
            key={item.command}
            variant="ghost"
            size="sm"
            onClick={() => handleCommand(item.command!)}
            className="h-8 w-8 p-0 flex-shrink-0"
            title={item.label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        )
      })}
    </div>
  )
}

export function UnifiedCrepeEditor({ 
  documentId, 
  initialContent = '', 
  onChange,
  wsUrl = 'ws://localhost:1234',
  collaborative = false,
  onImageLibraryOpen
}: UnifiedCrepeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imagePickerRef = useRef<ImagePickerRef>(null)
  const [saveCount, setSaveCount] = useState(0)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  const isUnmountingRef = useRef(false)

  // Image management hook with original implementation
  const {
    handleCustomImageUpload,
    createImageSelectHandler,
    setupImageBlockInterception,
    handleImagePickerClose,
    showImagePicker,
    setShowImagePicker,
    currentImageBlock,
    setCurrentImageBlock,
    pendingImageResolve,
    setPendingImageResolve
  } = useImageManagement()
  
  const {
    builder,
    isReady,
    hasError,
    errorMessage,
    createEditor,
    getContent,
    cleanup: cleanupEditor,
    setIsReady,
    setHasError,
    setErrorMessage
  } = useCrepeEditor({
    containerRef,
    initialContent,
    collaborative,
    onImageUpload: handleCustomImageUpload,
    // Disable the default floating toolbar
    disableToolbar: true
  })

  const {
    connectionStatus,
    collaborators,
    setupCollaboration,
    cleanup: cleanupCollaboration
  } = useCollaboration({
    documentId,
    wsUrl,
    initialContent
  })

  const handleContentChange = useMemo(() => {
    if (!onChange) return undefined
    
    return async (content: string) => {
      if (isUnmountingRef.current) return
      
      await onChange(content)
      setSaveCount(prev => prev + 1)
      setLastSaveTime(new Date())
    }
  }, [onChange])

  const { saveContent, cleanup: cleanupContentSync } = useContentSync({
    getContent,
    onChange: handleContentChange,
    collaborative,
    isReady
  })

  // Create the image select handler with all original strategies
  const handleImageSelect = useMemo(() => {
    return createImageSelectHandler(builder, getContent, saveContent)
  }, [createImageSelectHandler, builder, getContent, saveContent])

  // Handle toolbar image button click
  const handleToolbarImageClick = useCallback(() => {
    setShowImagePicker(true)
    if (onImageLibraryOpen) {
      onImageLibraryOpen()
    }
  }, [onImageLibraryOpen])

  // Set up image block click interception (maintaining original functionality)
  useEffect(() => {
    if (isUnmountingRef.current) return
    
    const cleanup = setupImageBlockInterception(containerRef, isReady)
    return cleanup
  }, [setupImageBlockInterception, isReady])

  // Cleanup function that handles proper order
  const performCleanup = useCallback(() => {
    console.log('🧹 Starting UnifiedCrepeEditor cleanup...')
    isUnmountingRef.current = true
    
    // Order is important here:
    // 1. Stop content monitoring first
    cleanupContentSync()
    
    // 2. Clean up collaboration (this will disconnect Y.js)
    cleanupCollaboration()
    
    // 3. Clean up editor last (this destroys Milkdown contexts)
    cleanupEditor()
    
    // 4. Reset image management state
    setPendingImageResolve(null)
    setCurrentImageBlock(null)
    
    console.log('✅ UnifiedCrepeEditor cleanup completed')
  }, [cleanupContentSync, cleanupCollaboration, cleanupEditor, setPendingImageResolve, setCurrentImageBlock])

  // Initialize editor with proper error handling
  useEffect(() => {
    let mounted = true
    
    const initializeEditor = async () => {
      if (isUnmountingRef.current) return
      
      try {
        console.log(`🚀 Initializing ${collaborative ? 'collaborative' : 'solo'} editor...`)
        
        const createdBuilder = await createEditor()
        if (!createdBuilder || !mounted || isUnmountingRef.current) return

        if (collaborative) {
          console.log('🤝 Setting up collaboration...')
          await setupCollaboration(createdBuilder)
          
          if (mounted && !isUnmountingRef.current) {
            setIsReady(true)
            console.log('✅ Collaborative editor ready')
          }
        } else {
          if (mounted && !isUnmountingRef.current) {
            setIsReady(true)
            console.log('✅ Solo editor ready')
          }
        }
      } catch (error) {
        console.error('❌ Failed to initialize editor:', error)
        if (mounted && !isUnmountingRef.current) {
          setHasError(true)
          setErrorMessage('Failed to initialize editor')
        }
      }
    }

    initializeEditor()
    
    return () => {
      mounted = false
    }
  }, [createEditor, collaborative, setupCollaboration, setIsReady, setHasError, setErrorMessage])

  // Cleanup on unmount with proper timing
  useEffect(() => {
    return () => {
      // Use setTimeout to ensure cleanup happens after all other effects
      setTimeout(() => {
        performCleanup()
      }, 0)
    }
  }, [performCleanup])

  // Public method to open image picker (for external calls)
  const openImagePicker = useCallback(() => {
    if (isUnmountingRef.current) return
    
    setShowImagePicker(true)
    if (onImageLibraryOpen) {
      onImageLibraryOpen()
    }
  }, [onImageLibraryOpen])

  // Expose the openImagePicker method to parent components
  useEffect(() => {
    if (containerRef.current && !isUnmountingRef.current) {
      (containerRef.current as any).openImagePicker = openImagePicker
    }
  }, [openImagePicker])

  const currentConnectionStatus = collaborative ? connectionStatus : 'solo'

  return (
    <div className="h-full w-full relative bg-background text-foreground transition-colors">
      {/* Enhanced image block button styling */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .milkdown-image-block .uploader {
            cursor: pointer !important;
            pointer-events: auto !important;
            display: inline-block !important;
            padding: 4px 8px !important;
            background: hsl(var(--primary)) !important;
            color: hsl(var(--primary-foreground)) !important;
            border-radius: 4px !important;
            text-decoration: none !important;
            font-size: 12px !important;
            transition: background-color 0.2s !important;
          }
          .milkdown-image-block .uploader:hover {
            background: hsl(var(--primary))/90 !important;
          }
          .milkdown-image-block .placeholder {
            pointer-events: auto !important;
          }
          .milkdown-image-block .link-input-area {
            background: hsl(var(--background)) !important;
            color: hsl(var(--foreground)) !important;
            border: 1px solid hsl(var(--border)) !important;
            border-radius: 4px !important;
            padding: 4px 8px !important;
          }
          
          /* Hide the default floating toolbar */
          .milkdown-toolbar {
            display: none !important;
          }
        `
      }} />
      
      <EditorStatusBar
        connectionStatus={currentConnectionStatus}
        collaborators={collaborators}
        collaborative={collaborative}
        hasError={hasError}
        errorMessage={errorMessage}
        isLoading={!isReady}
        documentId={documentId}
        saveCount={saveCount}
        lastSaveTime={lastSaveTime}
      />

      {/* Fixed Toolbar */}
      {isReady && !isUnmountingRef.current && (
        <div className="px-4 pt-4">
          <FixedToolbar 
            builder={builder} 
            onImageClick={handleToolbarImageClick}
          />
        </div>
      )}

      {/* Editor Container */}
      <div 
        ref={containerRef}
        className="h-full w-full crepe-editor-container overflow-auto"
        style={{ 
          height: isReady ? 'calc(100% - 112px)' : 'calc(100% - 48px)', // Adjust for toolbar
          width: '100%',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      />

      {/* Image Picker Dialog - maintaining original functionality */}
      {!isUnmountingRef.current && (
        <ImagePicker
          ref={imagePickerRef}
          onImageSelect={handleImageSelect}
          activeDir="docs"
          trigger={null}
          open={showImagePicker}
          onOpenChange={(open) => {
            if (!open && !isUnmountingRef.current) {
              handleImagePickerClose()
            }
          }}
        />
      )}
      
      {/* Loading overlay */}
      {!isReady && !isUnmountingRef.current && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/80 backdrop-blur-sm transition-colors">
          <div className="text-center">
            <div className={`animate-spin w-8 h-8 border-2 ${collaborative ? 'border-green-500 dark:border-green-400' : 'border-blue-500 dark:border-blue-400'} border-t-transparent rounded-full mx-auto mb-3`}></div>
            <div className="font-medium text-foreground">
              Loading {collaborative ? 'Collaborative' : 'Solo'} Editor...
            </div>
            <div className="text-xs mt-1 text-muted-foreground">
              {collaborative 
                ? 'Full Crepe features with real-time collaboration' 
                : 'Full Crepe features for single-user editing'
              }
            </div>
            <div className={`text-xs ${collaborative ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'} mt-1`}>
              ✅ Unified Crepe editor • Auto-save {collaborative ? '1s' : '1.5s'} • 📸 Asset management
            </div>
          </div>
        </div>
      )}
    </div>
  )
}