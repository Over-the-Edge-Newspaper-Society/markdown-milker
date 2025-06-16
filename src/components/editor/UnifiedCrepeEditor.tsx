// src/components/editor/UnifiedCrepeEditor.tsx (Refactored)
'use client'

import { useRef, useState, useMemo, useEffect } from 'react'
import { useCrepeEditor } from './hooks/useCrepeEditor'
import { useCollaboration } from './hooks/useCollaboration'
import { useContentSync } from './hooks/useContentSync'
import { useImageManagement } from './hooks/useImageManagement'
import { EditorStatusBar } from './components/EditorStatusBar'
import { ImagePicker } from './image-picker'

import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import '@milkdown/crepe/theme/frame-dark.css'

interface UnifiedCrepeEditorProps {
  documentId: string
  initialContent?: string
  onChange?: (markdown: string) => void
  wsUrl?: string
  collaborative?: boolean
}

export function UnifiedCrepeEditor({ 
  documentId, 
  initialContent = '', 
  onChange,
  wsUrl = 'ws://localhost:1234',
  collaborative = false
}: UnifiedCrepeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [saveCount, setSaveCount] = useState(0)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)

  // Custom hooks
  const { handleCustomImageUpload } = useImageManagement()
  
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
    onImageUpload: handleCustomImageUpload
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
      await onChange(content)
      setSaveCount(prev => prev + 1)
      setLastSaveTime(new Date())
    }
  }, [onChange])

  const { cleanup: cleanupContentSync } = useContentSync({
    getContent,
    onChange: handleContentChange,
    collaborative,
    isReady
  })

  // Initialize editor
  useEffect(() => {
    const initializeEditor = async () => {
      try {
        const createdBuilder = await createEditor()
        if (!createdBuilder) return

        if (collaborative) {
          await setupCollaboration(createdBuilder)
          setIsReady(true)
        }
      } catch (error) {
        console.error('Failed to initialize editor:', error)
        setHasError(true)
        setErrorMessage('Failed to initialize editor')
      }
    }

    initializeEditor()
  }, [createEditor, collaborative, setupCollaboration, setIsReady, setHasError, setErrorMessage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupContentSync()
      cleanupCollaboration()
      cleanupEditor()
    }
  }, [cleanupContentSync, cleanupCollaboration, cleanupEditor])

  // Handle image selection from picker
  const handleImageSelect = (imagePath: string) => {
    // TODO: Implement image insertion logic
    console.log('📸 Image selected from picker:', imagePath)
    setShowImagePicker(false)
  }

  const currentConnectionStatus = collaborative ? connectionStatus : 'solo'

  return (
    <div className="h-full w-full relative bg-background text-foreground transition-colors">
      {/* Image block button styling */}
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

      <div 
        ref={containerRef}
        className="h-full w-full bg-background text-foreground transition-colors crepe-editor-container"
        style={{ 
          height: 'calc(100% - 48px)',
          width: '100%'
        }}
      />

      {/* Image Picker Dialog */}
      {showImagePicker && (
        <ImagePicker
          onImageSelect={handleImageSelect}
          activeDir="docs"
          trigger={null}
          open={showImagePicker}
          onOpenChange={setShowImagePicker}
        />
      )}
      
      {/* Loading overlay */}
      {!isReady && (
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