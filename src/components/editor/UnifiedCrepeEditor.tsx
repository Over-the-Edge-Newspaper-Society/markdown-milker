// src/components/editor/UnifiedCrepeEditor.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CrepeBuilder } from '@milkdown/crepe/builder'
import { collab, collabServiceCtx } from '@milkdown/plugin-collab'
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs'

// Import all Crepe features
import { CrepeFeature } from '@milkdown/crepe'
import { blockEdit } from '@milkdown/crepe/feature/block-edit'
import { codeMirror } from '@milkdown/crepe/feature/code-mirror'
import { cursor } from '@milkdown/crepe/feature/cursor'
import { imageBlock } from '@milkdown/crepe/feature/image-block'
import { latex } from '@milkdown/crepe/feature/latex'
import { linkTooltip } from '@milkdown/crepe/feature/link-tooltip'
import { listItem } from '@milkdown/crepe/feature/list-item'
import { placeholder } from '@milkdown/crepe/feature/placeholder'
import { table } from '@milkdown/crepe/feature/table'
import { toolbar } from '@milkdown/crepe/feature/toolbar'

// Import the correct Milkdown contexts
import { editorViewCtx, commandsCtx } from '@milkdown/kit/core'
import { imageBlockSchema } from '@milkdown/kit/component/image-block'

// Import Crepe styles with theme support
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import '@milkdown/crepe/theme/frame-dark.css'

// Import image picker
import { ImagePicker } from './image-picker'
import { useEditorStore } from '@/lib/stores/editor-store'

interface UnifiedCrepeEditorProps {
  documentId: string
  initialContent?: string
  onChange?: (markdown: string) => void
  wsUrl?: string
  collaborative?: boolean
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'synced' | 'solo'

// Generate random color for user awareness
const randomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16)

export function UnifiedCrepeEditor({ 
  documentId, 
  initialContent = '', 
  onChange,
  wsUrl = 'ws://localhost:1234',
  collaborative = false
}: UnifiedCrepeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const builderRef = useRef<CrepeBuilder | null>(null)
  
  // Collaboration-specific refs (only used when collaborative=true)
  const ydocRef = useRef<Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const changeDetectionRef = useRef<NodeJS.Timeout | null>(null)
  
  const [isReady, setIsReady] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(collaborative ? 'connecting' : 'solo')
  const [collaborators, setCollaborators] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [saveCount, setSaveCount] = useState(0)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  const [showImagePicker, setShowImagePicker] = useState(false)
  
  const isInitializedRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const lastContentRef = useRef(initialContent)
  const initialContentAppliedRef = useRef(false)
  const isSavingRef = useRef(false)

  const { uploadImage, activeDirectory } = useEditorStore()

  // Keep onChange ref current
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const cleanup = useCallback(() => {
    console.log(`🧹 Cleaning up ${collaborative ? 'Collaborative' : 'Solo'} Crepe Editor`)
    
    // Clear intervals
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current)
      saveIntervalRef.current = null
    }
    if (changeDetectionRef.current) {
      clearInterval(changeDetectionRef.current)
      changeDetectionRef.current = null
    }
    
    // Cleanup collaboration (only if collaborative mode)
    if (collaborative) {
      if (providerRef.current) {
        try {
          providerRef.current.disconnect()
          providerRef.current.destroy()
        } catch (error) {
          console.error('Error destroying provider:', error)
        }
        providerRef.current = null
      }
      
      if (ydocRef.current) {
        try {
          ydocRef.current.destroy()
        } catch (error) {
          console.error('Error destroying Y.js doc:', error)
        }
        ydocRef.current = null
      }
    }
    
    // Cleanup Crepe editor
    if (builderRef.current) {
      try {
        builderRef.current.destroy()
      } catch (error) {
        console.error('Error destroying builder:', error)
      }
      builderRef.current = null
    }
    
    // Clean DOM
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
    
    // Reset state
    setIsReady(false)
    setConnectionStatus(collaborative ? 'disconnected' : 'solo')
    setCollaborators(0)
    setHasError(false)
    setIsLoading(true)
    setErrorMessage('')
    setSaveCount(0)
    setLastSaveTime(null)
    isInitializedRef.current = false
    initialContentAppliedRef.current = false
    isSavingRef.current = false
  }, [collaborative])

  // Enhanced image upload handler
  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    try {
      console.log('📸 Uploading image to assets:', file.name)
      const imagePath = await uploadImage(file)
      console.log('✅ Image uploaded successfully:', imagePath)
      return imagePath
    } catch (error) {
      console.error('❌ Image upload failed:', error)
      throw error
    }
  }, [uploadImage])

  // ✅ Unified save function (moved up to fix initialization order)
  const saveContent = useCallback(async (content: string, context: string = 'auto') => {
    if (isSavingRef.current || !onChangeRef.current) return false
    
    // Clean up the content: remove HTML tags and fix image paths
    let cleanedContent = content
      // Remove HTML tags like <br />
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      // Remove duplicate consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Clean up any angle brackets around image paths
      .replace(/!\[([^\]]*)\]\(<([^>]+)>\)/g, '![$1]($2)')
      // Trim extra whitespace
      .trim()
    
    if (cleanedContent === lastContentRef.current && context !== 'force') {
      return false
    }

    try {
      isSavingRef.current = true
      console.log(`💾 SAVING [${collaborative ? 'collaborative' : 'solo'}] [${context}]:`, cleanedContent.length, 'chars')
      
      if (cleanedContent !== content) {
        console.log('🧹 Cleaned HTML tags and formatting from content')
      }
      
      await onChangeRef.current(cleanedContent)
      
      lastContentRef.current = cleanedContent
      setSaveCount(prev => prev + 1)
      setLastSaveTime(new Date())
      
      console.log(`✅ SAVE SUCCESS [${context}]`)
      return true
    } catch (error) {
      console.error(`❌ SAVE FAILED [${context}]:`, error)
      return false
    } finally {
      isSavingRef.current = false
    }
  }, [collaborative])

  // Custom image upload handler that opens our image picker
  const handleCustomImageUpload = useCallback(async (file?: File | null): Promise<string> => {
    console.log('📸 Image upload handler called with file:', file ? file.name : 'no file')
    
    // If a file is provided, upload it directly
    if (file) {
      console.log('📸 File provided, uploading directly:', file.name)
      const result = await handleImageUpload(file)
      
      // Always return the API URL format for proper loading
      if (result.startsWith('/api/assets/serve?path=')) {
        return result
      } else if (result.startsWith('_assets/')) {
        const filename = result.replace('_assets/', '')
        return `/api/assets/serve?path=${encodeURIComponent(filename)}&activeDir=${encodeURIComponent(activeDirectory)}`
      } else {
        // Assume it's a filename
        return `/api/assets/serve?path=${encodeURIComponent(result)}&activeDir=${encodeURIComponent(activeDirectory)}`
      }
    }
    
    // If no file provided, this means user clicked the upload button
    // Open our custom image picker instead
    console.log('📸 No file provided, opening image picker')
    setShowImagePicker(true)
    
    // Return a promise that rejects so Milkdown doesn't wait
    return Promise.reject(new Error('User will select from picker'))
  }, [handleImageUpload, activeDirectory])

  // Enhanced markdown fallback for image insertion
  const insertMarkdownFallback = useCallback((imagePath: string) => {
    try {
      console.log('📸 Using markdown fallback insertion for:', imagePath)
      
      // Ensure we use the full API URL for images to work in markdown
      let finalPath = imagePath
      
      // If it's already an API URL, use it as-is
      if (imagePath.startsWith('/api/assets/serve?path=')) {
        finalPath = imagePath
      }
      // If it's a relative _assets path, convert to API URL
      else if (imagePath.startsWith('_assets/')) {
        const filename = imagePath.replace('_assets/', '')
        finalPath = `/api/assets/serve?path=${encodeURIComponent(filename)}&activeDir=${encodeURIComponent(activeDirectory)}`
      }
      // If it's just a filename, convert to API URL
      else if (!imagePath.startsWith('http') && !imagePath.startsWith('/api/')) {
        finalPath = `/api/assets/serve?path=${encodeURIComponent(imagePath)}&activeDir=${encodeURIComponent(activeDirectory)}`
      }
      
      // Create clean markdown with proper API URL
      const imageMarkdown = `![Image](${finalPath})`
      
      // Get current content and append the image
      if (builderRef.current && typeof builderRef.current.getMarkdown === 'function') {
        const currentContent = builderRef.current.getMarkdown()
        let newContent = currentContent
        
        // Add proper spacing
        if (currentContent && !currentContent.endsWith('\n')) {
          newContent += '\n\n'
        } else if (currentContent) {
          newContent += '\n'
        }
        
        newContent += imageMarkdown
        
        // Save the new content through the normal save mechanism
        saveContent(newContent, 'image-insert-fallback')
        console.log('✅ Image inserted via markdown fallback:', imageMarkdown)
      } else {
        // If editor isn't ready, just trigger save with the markdown
        console.log('✅ Image markdown prepared for insertion')
        saveContent(imageMarkdown, 'image-insert-fallback-simple')
      }
    } catch (error) {
      console.error('❌ Markdown fallback insertion failed:', error)
      // Last resort: just notify the user
      alert('Image uploaded successfully, but could not insert automatically. You can reference it with: ![Image](' + imagePath + ')')
    }
  }, [saveContent, activeDirectory])

  // Fixed image insertion using proper context objects
  const insertImageIntoEditor = useCallback((imagePath: string) => {
    if (!builderRef.current || !isReady) {
      console.warn('Editor not ready for image insertion')
      insertMarkdownFallback(imagePath)
      return
    }

    try {
      console.log('📸 Inserting image into editor:', imagePath)
      
      // Ensure we use the full API URL for proper loading
      let finalPath = imagePath
      
      // If it's already an API URL, use it as-is
      if (imagePath.startsWith('/api/assets/serve?path=')) {
        finalPath = imagePath
      }
      // If it's a relative _assets path, convert to API URL
      else if (imagePath.startsWith('_assets/')) {
        const filename = imagePath.replace('_assets/', '')
        finalPath = `/api/assets/serve?path=${encodeURIComponent(filename)}&activeDir=${encodeURIComponent(activeDirectory)}`
      }
      // If it's just a filename, convert to API URL
      else if (!imagePath.startsWith('http') && !imagePath.startsWith('/api/')) {
        finalPath = `/api/assets/serve?path=${encodeURIComponent(imagePath)}&activeDir=${encodeURIComponent(activeDirectory)}`
      }
      
      console.log('📸 Final image URL for insertion:', finalPath)
      
      // Check if we can use the CrepeBuilder's getMarkdown method to verify editor state
      if (typeof builderRef.current.getMarkdown === 'function') {
        // Editor is ready, try direct insertion
        try {
          builderRef.current.editor.action((ctx) => {
            try {
              // Get the editor view and schema using proper context objects
              const view = ctx.get(editorViewCtx)
              
              if (view && view.state && view.state.schema) {
                const schema = view.state.schema
                
                // Check if image node type exists
                const imageNodeType = schema.nodes.image || schema.nodes.imageBlock
                
                if (imageNodeType) {
                  // Create image node with proper API path
                  const imageNode = imageNodeType.create({
                    src: finalPath,
                    alt: 'Uploaded image',
                    title: ''
                  })
                  
                  // Insert at current cursor position
                  const { state } = view
                  const transaction = state.tr.replaceSelectionWith(imageNode)
                  view.dispatch(transaction)
                  
                  console.log('✅ Image inserted successfully via ProseMirror')
                  return
                }
              }
              
              // If we get here, fall back to markdown
              throw new Error('Could not access editor view or schema')
            } catch (innerError) {
              console.warn('Inner editor insertion failed:', innerError)
              throw innerError
            }
          })
        } catch (actionError) {
          console.warn('Editor action failed, using markdown fallback:', actionError)
          insertMarkdownFallback(finalPath)
        }
      } else {
        // Editor might not be fully ready, use fallback
        console.warn('Editor getMarkdown method not available, using fallback')
        insertMarkdownFallback(finalPath)
      }
    } catch (error) {
      console.error('❌ Failed to insert image:', error)
      insertMarkdownFallback(imagePath)
    }
  }, [isReady, insertMarkdownFallback, activeDirectory])

  // Handle image selection from picker
  const handleImageSelect = useCallback((imagePath: string) => {
    console.log('📸 Image selected from picker:', imagePath)
    
    // The image picker should return the relativePath (_assets/filename)
    // We'll let insertImageIntoEditor handle the API URL conversion
    let finalPath = imagePath
    
    // If it's already the API URL, extract the relative path and let the insert function handle conversion
    if (imagePath.startsWith('/api/assets/serve?path=')) {
      const urlParams = new URLSearchParams(imagePath.split('?')[1])
      const filename = urlParams.get('path')
      if (filename) {
        finalPath = `_assets/${filename}`
      }
    }
    
    console.log('📸 Final path for insertion:', finalPath)
    
    insertImageIntoEditor(finalPath)
    setShowImagePicker(false)
  }, [insertImageIntoEditor])

  // Enhanced image upload that also inserts
  const handleImageUploadAndInsert = useCallback(async (file: File): Promise<string> => {
    try {
      const imagePath = await handleImageUpload(file)
      
      // Convert to relative path format for insertion
      let finalPath = imagePath
      if (imagePath.startsWith('/api/assets/serve?path=')) {
        const urlParams = new URLSearchParams(imagePath.split('?')[1])
        const filename = urlParams.get('path')
        if (filename) {
          finalPath = `_assets/${filename}`
        }
      }
      
      insertImageIntoEditor(finalPath)
      return finalPath
    } catch (error) {
      console.error('❌ Image upload and insert failed:', error)
      throw error
    }
  }, [handleImageUpload, insertImageIntoEditor])

  // ✅ Unified content extraction method
  const getEditorContent = useCallback((): string => {
    try {
      if (!builderRef.current) return ''
      
      // Try multiple methods to get content
      const methods = ['getMarkdown', 'getValue', 'getContent']
      
      for (const method of methods) {
        if (typeof (builderRef.current as any)[method] === 'function') {
          try {
            const content = (builderRef.current as any)[method]()
            if (typeof content === 'string' && content.length >= 0) {
              return content
            }
          } catch (e) {
            console.log(`Method ${method} failed:`, (e as Error).message)
          }
        }
      }
      
      // Fallback: try Y.js document directly (collaborative mode only)
      if (collaborative && ydocRef.current) {
        const yText = ydocRef.current.getText('milkdown')
        return yText.toString()
      }
      
      return ''
    } catch (error) {
      console.error('Error getting editor content:', error)
      return ''
    }
  }, [collaborative])

  // ✅ Smart content application (collaborative mode only)
  const applyInitialContentSafely = useCallback(async (collabService: any) => {
    if (!collaborative || initialContentAppliedRef.current) return

    const currentCollaborators = providerRef.current?.awareness.getStates().size || 0
    
    if (currentCollaborators > 1) {
      console.log('👥 Multiple users detected - preserving collaborative state')
      initialContentAppliedRef.current = true
      return
    }

    if (ydocRef.current) {
      const yText = ydocRef.current.getText('milkdown')
      const existingContent = yText.toString()
      
      if (existingContent && existingContent.length > 0) {
        console.log('📄 Y.js document has content, preserving it')
        lastContentRef.current = existingContent
        initialContentAppliedRef.current = true
        return
      }
    }

    if (initialContent && initialContent.trim() !== '') {
      console.log('📋 Applying initial content to empty collaborative document')
      try {
        await collabService.applyTemplate(initialContent, () => true)
        lastContentRef.current = initialContent
        initialContentAppliedRef.current = true
      } catch (error) {
        console.error('Error applying initial content:', error)
      }
    } else {
      initialContentAppliedRef.current = true
    }
  }, [collaborative, initialContent])

  // ✅ Setup content monitoring
  const setupContentMonitoring = useCallback(() => {
    if (collaborative) {
      // Collaborative mode: frequent auto-save
      saveIntervalRef.current = setInterval(async () => {
        if (isReady && initialContentAppliedRef.current) {
          const content = getEditorContent()
          if (content) {
            await saveContent(content, 'collaborative-auto')
          }
        }
      }, 1000)
      
      // Y.js change listener
      if (ydocRef.current) {
        ydocRef.current.on('update', async (update: Uint8Array, origin: any) => {
          if (origin !== 'file-load' && initialContentAppliedRef.current) {
            setTimeout(async () => {
              const content = getEditorContent()
              if (content) {
                await saveContent(content, 'yjs-update')
              }
            }, 200)
          }
        })
      }
    } else {
      // Solo mode: debounced change detection
      changeDetectionRef.current = setInterval(async () => {
        if (isReady) {
          const content = getEditorContent()
          if (content && content !== lastContentRef.current) {
            console.log('✏️ Solo mode content change detected')
            await saveContent(content, 'solo-auto')
          }
        }
      }, 1500) // Debounced for solo mode
    }
    
    console.log(`📊 Content monitoring set up for ${collaborative ? 'collaborative' : 'solo'} mode`)
  }, [collaborative, isReady, getEditorContent, saveContent])

  // ✅ Initialize collaboration (only if collaborative=true)
  const initializeCollaboration = useCallback(async (builder: CrepeBuilder) => {
    if (!collaborative) return

    console.log('🤝 Setting up Y.js collaboration...')
    
    const ydoc = new Doc()
    ydocRef.current = ydoc

    const provider = new WebsocketProvider(wsUrl, documentId, ydoc, {
      connect: true,
      params: { documentId },
      resyncInterval: 2000,
      maxBackoffTime: 1000
    })
    providerRef.current = provider

    provider.awareness.setLocalStateField('user', {
      color: randomColor(),
      name: `User-${Math.floor(Math.random() * 1000)}`
    })

    // Event listeners
    provider.on('status', (payload: { status: string }) => {
      setConnectionStatus(payload.status as ConnectionStatus)
    })

    provider.on('connection-close', () => setConnectionStatus('disconnected'))
    provider.on('connection-error', () => setConnectionStatus('error'))

    provider.awareness.on('change', () => {
      const states = provider.awareness.getStates()
      setCollaborators(states.size)
    })

    // Setup collaboration service
    builder.editor.action((ctx) => {
      const collabService = ctx.get(collabServiceCtx)
      collabService.bindDoc(ydoc).setAwareness(provider.awareness)

      provider.once('synced', async (isSynced: boolean) => {
        if (isSynced) {
          try {
            await collabService.connect()
            
            setTimeout(async () => {
              await applyInitialContentSafely(collabService)
              setConnectionStatus('synced')
              setIsReady(true)
              setIsLoading(false)
              setupContentMonitoring()
              
              console.log('🎉 Collaborative editor ready!')
            }, 500)
          } catch (error) {
            console.error('Collaboration setup error:', error)
            setHasError(true)
            setErrorMessage('Collaboration setup failed')
            setIsLoading(false)
          }
        }
      })
    })
  }, [collaborative, wsUrl, documentId, applyInitialContentSafely, setupContentMonitoring])

  // Custom slash command handler for images
  const setupImageSlashCommand = useCallback((builder: CrepeBuilder) => {
    // Hook into the editor to intercept slash commands
    builder.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        
        if (view) {
          // Listen for input events to detect "/image" command
          view.dom.addEventListener('input', (event) => {
            const target = event.target as HTMLElement
            if (target && target.textContent) {
              const text = target.textContent
              const cursorPos = window.getSelection()?.anchorOffset || 0
              const beforeCursor = text.slice(Math.max(0, cursorPos - 10), cursorPos)
              
              // Check if user typed "/image" and show picker
              if (beforeCursor.includes('/image') && !showImagePicker) {
                console.log('📸 Image slash command detected')
                setTimeout(() => setShowImagePicker(true), 100)
              }
            }
          })
        }
      } catch (error) {
        console.warn('Could not set up slash command handler:', error)
      }
    })
  }, [showImagePicker])

  // ✅ Main editor initialization
  const initializeEditor = useCallback(async () => {
    if (!containerRef.current || builderRef.current || isInitializedRef.current) {
      return
    }

    isInitializedRef.current = true
    
    try {
      containerRef.current.innerHTML = ''
      
      console.log(`🎯 Creating ${collaborative ? 'Collaborative' : 'Solo'} Crepe Editor`)

      // Create CrepeBuilder with consistent setup
      const builder = new CrepeBuilder({
        root: containerRef.current,
        defaultValue: collaborative ? '' : initialContent // Solo mode gets content immediately
      })

      // Add collaboration plugin ONLY in collaborative mode
      if (collaborative) {
        console.log('✅ Adding collaboration plugin')
        builder.editor.use(collab)
      }

      console.log('✅ Adding all Crepe features')
      
      // Add all Crepe features (same for both modes)
      builder.addFeature(cursor, { 
        color: collaborative ? '#3b82f6' : '#6b7280', 
        width: 2, 
        virtual: true 
      })
      builder.addFeature(listItem, {})
      builder.addFeature(linkTooltip, {})
      
      // Enhanced image block with asset management and custom picker
      builder.addFeature(imageBlock, {
        onUpload: handleCustomImageUpload,
        blockUploadPlaceholderText: 'Paste image URL or click to browse library',
        blockUploadButton: 'Browse Library',
        inlineUploadPlaceholderText: 'Paste image URL or click to browse',
        inlineUploadButton: 'Browse',
      })
      
      builder.addFeature(blockEdit, {})
      builder.addFeature(placeholder, { 
        text: collaborative ? 'Start collaborating...' : 'Start writing...', 
        mode: 'block' 
      })
      builder.addFeature(toolbar, {})
      builder.addFeature(codeMirror, {})
      builder.addFeature(table, {})
      builder.addFeature(latex, {})

      console.log('✅ Creating editor instance...')
      await builder.create()
      builderRef.current = builder
      
      // Setup image block click handlers (but not slash commands)
      setTimeout(() => {
        if (containerRef.current) {
          console.log('📸 Setting up image block click handlers')
          
          const handleImageBlockClick = (e: Event) => {
            const target = e.target as HTMLElement
            
            // Check if it's our upload button or label
            if (target.classList.contains('uploader') || 
                target.textContent?.includes('Browse Library') ||
                target.textContent?.includes('Browse') ||
                target.closest('.uploader')) {
              
              console.log('📸 Image block upload button clicked')
              e.preventDefault()
              e.stopPropagation()
              setShowImagePicker(true)
            }
          }
          
          // Add event listener to the container with capture
          containerRef.current.addEventListener('click', handleImageBlockClick, true)
        }
      }, 1000)

      if (collaborative) {
        // Collaborative mode: setup Y.js
        await initializeCollaboration(builder)
      } else {
        // Solo mode: ready immediately
        lastContentRef.current = initialContent
        initialContentAppliedRef.current = true
        setConnectionStatus('solo')
        setIsReady(true)
        setIsLoading(false)
        setupContentMonitoring()
        
        console.log('✅ Solo editor ready!')
      }

    } catch (error) {
      console.error('Failed to create editor:', error)
      setHasError(true)
      setErrorMessage(`Failed to initialize ${collaborative ? 'collaborative' : 'solo'} editor`)
      setIsLoading(false)
      isInitializedRef.current = false
    }
  }, [collaborative, documentId, initialContent, initializeCollaboration, setupContentMonitoring, handleCustomImageUpload, showImagePicker])

  // Initialize editor on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      console.log(`🚀 Initializing ${collaborative ? 'Collaborative' : 'Solo'} Crepe Editor`)
      const timer = setTimeout(() => {
        initializeEditor().catch(error => {
          console.error('Failed to initialize editor:', error)
          setHasError(true)
          setErrorMessage('Failed to initialize editor')
          setIsLoading(false)
        })
      }, 50)

      return () => clearTimeout(timer)
    }
  }, [initializeEditor])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log(`🧹 ${collaborative ? 'Collaborative' : 'Solo'} Crepe Editor unmounting`)
      cleanup()
    }
  }, [cleanup])

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = async () => {
      const content = getEditorContent()
      if (content) {
        await saveContent(content, 'before-unload')
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [getEditorContent, saveContent])

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

  const getSaveFrequency = () => {
    return collaborative ? '1s' : '1.5s'
  }

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
      
      {/* Unified status bar with theme awareness */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30 text-sm backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()} transition-colors`} />
          <span className="font-medium">{getStatusText()}</span>
          
          {showImagePicker && (
            <div className="flex items-center gap-1">
              <span className="text-blue-600 dark:text-blue-400">•</span>
              <span className="text-blue-600 dark:text-blue-400">🖼️ Asset library</span>
            </div>
          )}
          
          {isReady && !hasError && (
            <>
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
              <div className="flex items-center gap-1">
                <span className="text-orange-600 dark:text-orange-400 text-xs">•</span>
                <span className="text-orange-600 dark:text-orange-400 text-xs">Auto-save {getSaveFrequency()}</span>
              </div>
              {!collaborative && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-600 dark:text-gray-400 text-xs">•</span>
                  <span className="text-gray-600 dark:text-gray-400 text-xs">Single user</span>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>{documentId}</span>
          <span>•</span>
          <span className={collaborative ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}>
            {collaborative ? 'Collaborative' : 'Solo'} Mode
          </span>
          {/* Image Picker Button */}
          <ImagePicker 
            onImageSelect={handleImageSelect} 
            activeDir={activeDirectory}
            trigger={
              <button
                onClick={() => setShowImagePicker(true)}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                title="Insert image"
              >
                📸 Insert
              </button>
            }
          />
        </div>
      </div>

      {/* Unified editor container with theme-aware styling */}
      <div 
        ref={containerRef}
        className="h-full w-full bg-background text-foreground transition-colors crepe-editor-container"
        style={{ 
          height: 'calc(100% - 48px)',
          width: '100%'
        }}
      />

      {/* Image Picker Dialog for Slash Commands */}
      {showImagePicker && (
        <ImagePicker
          onImageSelect={handleImageSelect}
          activeDir={activeDirectory}
          trigger={null}
          open={showImagePicker}
          onOpenChange={setShowImagePicker}
        />
      )}
      
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/80 backdrop-blur-sm transition-colors">
          <div className="text-center">
            <div className={`animate-spin w-8 h-8 border-2 ${collaborative ? 'border-green-500 dark:border-green-400' : 'border-blue-500 dark:border-blue-400'} border-t-transparent rounded-full mx-auto mb-3`}></div>
            <div className="font-medium text-foreground">
              {isLoading ? `Loading ${collaborative ? 'Collaborative' : 'Solo'} Editor...` : 'Preparing editor...'}
            </div>
            <div className="text-xs mt-1 text-muted-foreground">
              {collaborative 
                ? 'Full Crepe features with real-time collaboration' 
                : 'Full Crepe features for single-user editing'
              }
            </div>
            <div className={`text-xs ${collaborative ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'} mt-1`}>
              ✅ Unified Crepe editor • Auto-save {getSaveFrequency()} • 📸 Asset management
            </div>
          </div>
        </div>
      )}
    </div>
  )
}