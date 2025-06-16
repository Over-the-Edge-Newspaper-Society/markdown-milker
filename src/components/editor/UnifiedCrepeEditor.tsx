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

  // Enhanced insertImageIntoBlock function with Milkdown-specific fixes
  const insertImageIntoBlock = (imageBlock: HTMLElement, imagePath: string) => {
    console.log('🎯 Inserting image into block:', imagePath)
    console.log('🔍 Image block HTML:', imageBlock.outerHTML.substring(0, 500))
    
    // Try multiple selectors to find the input field
    const selectors = [
      '.link-input-area',
      'input[type="text"]',
      'input[placeholder*="image"]',
      'input[placeholder*="URL"]',
      'input[placeholder*="url"]',
      '.image-input',
      '.url-input',
      '.link-input',
      'input'
    ]
    
    let input: HTMLInputElement | null = null
    
    for (const selector of selectors) {
      input = imageBlock.querySelector(selector) as HTMLInputElement
      if (input) {
        console.log(`📝 Found input with selector: ${selector}`)
        break
      }
    }
    
    if (!input) {
      console.error('❌ Could not find any input field in image block')
      return false
    }

    console.log('📝 Input element:', input)
    console.log('📝 Input current value:', input.value)
    console.log('📝 Input placeholder:', input.placeholder)
    
    // CRITICAL FIX: Use a more aggressive approach for Milkdown
    const setValueAndTrigger = () => {
      // Clear first
      input!.value = ''
      input!.dispatchEvent(new Event('input', { bubbles: true }))
      
      // Small delay then set the actual value
      setTimeout(() => {
        input!.value = imagePath
        input!.setAttribute('value', imagePath)
        
        // Focus and select all
        input!.focus()
        input!.select()
        
        // Dispatch input event immediately
        input!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
        
        // Then dispatch change
        setTimeout(() => {
          input!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
          
          // Finally try Enter key
          setTimeout(() => {
            const enterEvent = new KeyboardEvent('keydown', {
              bubbles: true,
              cancelable: true,
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13
            })
            input!.dispatchEvent(enterEvent)
            
            // Also dispatch keyup
            const enterUpEvent = new KeyboardEvent('keyup', {
              bubbles: true,
              cancelable: true,
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13
            })
            input!.dispatchEvent(enterUpEvent)
            
            // Force blur to commit the value
            setTimeout(() => {
              input!.blur()
            }, 50)
            
          }, 100)
        }, 50)
      }, 50)
    }
    
    // Execute the value setting
    setValueAndTrigger()
    
    // Also try to find any submit/confirm buttons
    setTimeout(() => {
      const buttons = imageBlock.querySelectorAll('button, [role="button"], .confirm, .submit, .ok')
      for (const button of buttons) {
        if (button.textContent?.toLowerCase().includes('ok') || 
            button.textContent?.toLowerCase().includes('confirm') ||
            button.textContent?.toLowerCase().includes('submit') ||
            (button as HTMLElement).classList.contains('confirm')) {
          console.log('📤 Clicking confirm button:', button.textContent)
          ;(button as HTMLElement).click()
          break
        }
      }
    }, 300)
    
    console.log('✅ Enhanced image insertion events dispatched')
    return true
  }

  // Alternative approach using Milkdown API directly
  const insertImageViaAPI = (imagePath: string) => {
    if (!builder) return false
    
    try {
      console.log('🎯 Attempting API-based image insertion')
      
      // Try to access the Milkdown editor instance
      builder.editor.action((ctx) => {
        try {
          // Import the necessary contexts
          const view = ctx.get('editorViewCtx' as any)
          const schema = view.state.schema
          
          console.log('📝 Got editor view and schema')
          
          // Create image node
          const imageNodeType = schema.nodes.image || schema.nodes.imageBlock
          if (!imageNodeType) {
            console.error('❌ No image node type found in schema')
            return false
          }
          
          const imageNode = imageNodeType.create({
            src: imagePath,
            alt: 'Uploaded image',
            title: ''
          })
          
          console.log('📝 Created image node:', imageNode)
          
          // Get current selection
          const { state } = view
          const { selection } = state
          
          // Create transaction to insert image
          const transaction = state.tr.replaceSelectionWith(imageNode)
          
          // Dispatch the transaction
          view.dispatch(transaction)
          
          console.log('✅ Image inserted via Milkdown API')
          return true
          
        } catch (apiError) {
          console.error('❌ API insertion failed:', apiError)
          return false
        }
      })
      
      return true
      
    } catch (error) {
      console.error('❌ Failed to access editor context:', error)
      return false
    }
  }

  // Enhanced markdown fallback that ensures the content is actually saved
  const insertMarkdownFallback = (imagePath: string) => {
    try {
      console.log('📸 Using enhanced markdown fallback insertion for:', imagePath)
      
      // Create clean markdown
      const imageMarkdown = `![Uploaded Image](${imagePath})`
      
      // Get current content
      const currentContent = getContent()
      console.log('📖 Current content length:', currentContent.length)
      
      // Prepare new content with proper spacing
      let newContent = currentContent
      if (currentContent && !currentContent.endsWith('\n')) {
        newContent += '\n\n'
      } else if (currentContent) {
        newContent += '\n'
      }
      newContent += imageMarkdown + '\n'
      
      console.log('📝 New content length:', newContent.length)
      console.log('📝 Image markdown to insert:', imageMarkdown)
      
      // Try to trigger the onChange callback directly
      if (handleContentChange) {
        console.log('📤 Calling handleContentChange directly')
        handleContentChange(newContent)
      }
      
      // Also try to set content if builder has methods
      if (builder) {
        const setMethods = ['setMarkdown', 'setValue', 'setContent']
        for (const method of setMethods) {
          if (typeof (builder as any)[method] === 'function') {
            try {
              ;(builder as any)[method](newContent)
              console.log(`✅ Set content using ${method}`)
              break
            } catch (e) {
              console.log(`❌ Failed to set content with ${method}:`, e)
            }
          }
        }
      }
      
      console.log('✅ Enhanced markdown fallback completed')
      
    } catch (error) {
      console.error('❌ Enhanced markdown fallback failed:', error)
      
      // Ultimate fallback: copy to clipboard and notify user
      if (navigator.clipboard) {
        const markdown = `![Uploaded Image](${imagePath})`
        navigator.clipboard.writeText(markdown).then(() => {
          alert('Image URL copied to clipboard. Please paste it manually in the editor.')
        })
      } else {
        alert(`Image uploaded successfully! Please manually add: ![Uploaded Image](${imagePath})`)
      }
    }
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

  // Updated handleImageSelect with API approach first
  const handleImageSelect = (imagePath: string) => {
    console.log('📸 Image selected from picker:', imagePath)
    setShowImagePicker(false)
    
    // Convert relative path to proper format
    let processedImagePath = imagePath
    
    if (imagePath.startsWith('_assets/')) {
      const filename = imagePath.replace('_assets/', '')
      processedImagePath = `/api/assets/serve?path=${encodeURIComponent(filename)}&activeDir=docs`
    } else if (!imagePath.startsWith('http') && !imagePath.startsWith('/api/')) {
      processedImagePath = `/api/assets/serve?path=${encodeURIComponent(imagePath)}&activeDir=docs`
    }
    
    console.log('🔄 Processed image path:', processedImagePath)
    
    // Strategy 0: Try Milkdown API first (NEW)
    console.log('🎯 Strategy 0: Using Milkdown API directly')
    if (insertImageViaAPI(processedImagePath)) {
      console.log('✅ Image inserted successfully via Strategy 0 (API)')
      setCurrentImageBlock(null)
      return
    }
    
    // Strategy 1: Try to insert into current image block
    if (currentImageBlock) {
      console.log('🎯 Strategy 1: Inserting into current image block')
      const success = insertImageIntoBlock(currentImageBlock, processedImagePath)
      if (success) {
        console.log('✅ Image inserted successfully via Strategy 1')
        setCurrentImageBlock(null)
        
        // Wait a bit then check if it worked
        setTimeout(() => {
          const content = getContent()
          if (content.includes(processedImagePath)) {
            console.log('✅ Confirmed image in content')
          } else {
            console.warn('⚠️ Image not found in content, trying fallback')
            insertMarkdownFallback(processedImagePath)
          }
        }, 1000)
        
        return
      }
    }
    
    // Strategy 2: Try to find any active image block
    console.log('🎯 Strategy 2: Looking for any active image block')
    if (containerRef.current) {
      const activeImageBlocks = containerRef.current.querySelectorAll('.milkdown-image-block, [class*="image-block"]')
      for (let i = 0; i < activeImageBlocks.length; i++) {
        const block = activeImageBlocks[i]
        if (insertImageIntoBlock(block as HTMLElement, processedImagePath)) {
          console.log('✅ Image inserted successfully via Strategy 2')
          setCurrentImageBlock(null)
          
          // Wait and verify
          setTimeout(() => {
            const content = getContent()
            if (!content.includes(processedImagePath)) {
              console.warn('⚠️ Image not confirmed, using fallback')
              insertMarkdownFallback(processedImagePath)
            }
          }, 1000)
          
          return
        }
      }
    }
    
    // Strategy 3: Use markdown fallback
    console.log('🎯 Strategy 3: Using markdown fallback')
    insertMarkdownFallback(processedImagePath)
    
    // Strategy 4: Resolve pending promise (for programmatic insertion)
    if (pendingImageResolve) {
      console.log('🎯 Strategy 4: Resolving pending promise')
      pendingImageResolve(processedImagePath)
      setPendingImageResolve(null)
    }
    
    setCurrentImageBlock(null)
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