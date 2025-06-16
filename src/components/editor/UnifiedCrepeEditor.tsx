// src/components/editor/UnifiedCrepeEditor.tsx (Fixed Image Insertion)
'use client'

import { useRef, useState, useMemo, useEffect } from 'react'
import { useCrepeEditor } from './hooks/useCrepeEditor'
import { useCollaboration } from './hooks/useCollaboration'
import { useContentSync } from './hooks/useContentSync'
import { useImageManagement } from './hooks/useImageManagement'
import { EditorStatusBar } from './components/EditorStatusBar'
import { ImagePicker, type ImagePickerRef } from './image-picker'

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
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [saveCount, setSaveCount] = useState(0)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  const [pendingImageResolve, setPendingImageResolve] = useState<((value: string) => void) | null>(null)
  const [currentImageBlock, setCurrentImageBlock] = useState<HTMLElement | null>(null)

  // Custom hooks
  const { handleCustomImageUpload } = useImageManagement()
  
  // Enhanced image upload handler that opens the picker for "browse library"
  const handleImageUploadWithPicker = async (file?: File | null): Promise<string> => {
    if (file) {
      // User provided a file - upload it normally
      return await handleCustomImageUpload(file)
    } else {
      // No file provided - user wants to browse library
      console.log('📸 Opening image picker for library browsing...')
      setShowImagePicker(true)
      
      // Return a promise that will be resolved when user selects an image
      return new Promise((resolve, reject) => {
        setPendingImageResolve(() => resolve)
        
        // Auto-reject after 30 seconds to prevent hanging
        setTimeout(() => {
          setPendingImageResolve(null)
          reject(new Error('Image selection timeout'))
        }, 30000)
      })
    }
  }
  
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
    onImageUpload: handleImageUploadWithPicker
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

  // Helper function to insert image into the current image block
  const insertImageIntoBlock = (imageBlock: HTMLElement, imagePath: string) => {
    console.log('🎯 Inserting image into block:', imagePath)
    
    // Find the input field in the image block
    const input = imageBlock.querySelector('.link-input-area') as HTMLInputElement
    if (!input) {
      console.error('❌ Could not find link-input-area in image block')
      return false
    }

    console.log('📝 Found input field, setting value...')
    
    // Set the value
    input.value = imagePath
    input.setAttribute('value', imagePath)
    
    // Focus the input to ensure it's active
    input.focus()
    
    // Dispatch multiple events to ensure Milkdown picks up the change
    const events = ['input', 'change', 'blur', 'keyup']
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true, cancelable: true })
      input.dispatchEvent(event)
    })
    
    // Also try synthetic keyboard events
    const enterEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13
    })
    input.dispatchEvent(enterEvent)
    
    // Try to trigger blur to finalize the input
    setTimeout(() => {
      input.blur()
      input.focus()
      input.blur()
    }, 100)
    
    console.log('✅ Image insertion events dispatched')
    return true
  }

  // Set up click interception for image block "Browse Library" buttons
  useEffect(() => {
    if (!containerRef.current || !isReady) return

    const handleImageBlockClick = (event: Event) => {
      const target = event.target as HTMLElement
      
      // Check if this is the "Browse Library" button in an image block
      if (target.classList.contains('uploader') || 
          target.closest('.uploader') ||
          (target.textContent && target.textContent.includes('Browse Library'))) {
        
        console.log('📸 Image block Browse Library clicked!')
        event.preventDefault()
        event.stopPropagation()
        
        // Find the parent image block
        const imageBlock = target.closest('.milkdown-image-block') as HTMLElement
        if (imageBlock) {
          console.log('🎯 Found parent image block')
          setCurrentImageBlock(imageBlock)
        }
        
        // Open our image picker instead of file dialog
        setShowImagePicker(true)
        return false
      }
    }

    // Add event listener with capture to intercept before default behavior
    containerRef.current.addEventListener('click', handleImageBlockClick, true)
    
    // Also listen for file input clicks and redirect them
    const handleFileInputClick = (event: Event) => {
      const target = event.target as HTMLInputElement
      if (target.type === 'file' && target.accept?.includes('image')) {
        console.log('📸 File input intercepted!')
        event.preventDefault()
        event.stopPropagation()
        
        // Find the parent image block
        const imageBlock = target.closest('.milkdown-image-block') as HTMLElement
        if (imageBlock) {
          setCurrentImageBlock(imageBlock)
        }
        
        // Trigger our image picker instead
        setShowImagePicker(true)
        return false
      }
    }
    
    containerRef.current.addEventListener('click', handleFileInputClick, true)

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('click', handleImageBlockClick, true)
        containerRef.current.removeEventListener('click', handleFileInputClick, true)
      }
    }
  }, [isReady])

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
      setPendingImageResolve(null)
      setCurrentImageBlock(null)
    }
  }, [cleanupContentSync, cleanupCollaboration, cleanupEditor])

  // Handle image selection from picker
  const handleImageSelect = (imagePath: string) => {
    console.log('📸 Image selected from picker:', imagePath)
    setShowImagePicker(false)
    
    // Convert relative path to proper format
    let processedImagePath = imagePath
    
    // If it's a relative path like "_assets/image.jpg", convert to full URL
    if (imagePath.startsWith('_assets/')) {
      const filename = imagePath.replace('_assets/', '')
      processedImagePath = `/api/assets/serve?path=${encodeURIComponent(filename)}&activeDir=docs`
    } else if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
      // If it's just a filename, add the full path
      processedImagePath = `/api/assets/serve?path=${encodeURIComponent(imagePath)}&activeDir=docs`
    }
    
    console.log('🔄 Processed image path:', processedImagePath)
    
    // If we have a current image block, insert the image directly
    if (currentImageBlock) {
      console.log('🎯 Inserting into current image block')
      const success = insertImageIntoBlock(currentImageBlock, processedImagePath)
      if (success) {
        console.log('✅ Image inserted successfully')
      } else {
        console.error('❌ Failed to insert image into block')
      }
      setCurrentImageBlock(null)
    }
    
    // Also resolve the pending promise if it exists (for fallback)
    if (pendingImageResolve) {
      pendingImageResolve(processedImagePath)
      setPendingImageResolve(null)
    }
  }

  // Handle image picker close without selection
  const handleImagePickerClose = () => {
    console.log('📸 Image picker closed without selection')
    setShowImagePicker(false)
    setPendingImageResolve(null)
    setCurrentImageBlock(null)
  }

  // Public method to open image picker (for external calls)
  const openImagePicker = () => {
    setShowImagePicker(true)
    if (onImageLibraryOpen) {
      onImageLibraryOpen()
    }
  }

  // Expose the openImagePicker method to parent components
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).openImagePicker = openImagePicker
    }
  }, [])

  const currentConnectionStatus = collaborative ? connectionStatus : 'solo'

  return (
    <div className="h-full w-full relative bg-background text-foreground transition-colors">
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
        className="h-full w-full crepe-editor-container overflow-auto"
        style={{ 
          height: 'calc(100% - 48px)',
          width: '100%',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      />

      {/* Image Picker Dialog */}
      <ImagePicker
        ref={imagePickerRef}
        onImageSelect={handleImageSelect}
        activeDir="docs"
        trigger={null}
        open={showImagePicker}
        onOpenChange={(open) => {
          if (!open) {
            handleImagePickerClose()
          }
        }}
      />
      
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