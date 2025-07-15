// src/components/editor/UnifiedCrepeEditor.tsx (Refactored - Selective CSS)
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

// Only import essential Crepe styles - no theme overrides
import '@milkdown/crepe/theme/common/style.css'

// Import our modular CSS files instead of one large file
import './styles/editor-base.css'
import './styles/editor-theme.css'
import './styles/editor-components.css'

interface UnifiedCrepeEditorProps {
  documentId: string
  initialContent?: string
  onChange?: (markdown: string) => void
  wsUrl?: string
  collaborative?: boolean
  onImageLibraryOpen?: () => void
}

interface FixedToolbarProps {
  builder: any
  onImageClick: () => void
}

// Updated command mapping for Milkdown
const COMMAND_MAP = {
  bold: 'ToggleStrongCommand',
  italic: 'ToggleEmphasisCommand', 
  strikethrough: 'ToggleStrikethroughCommand',
  code: 'ToggleInlineCodeCommand',
  link: 'ToggleLinkCommand',
  bulletList: 'WrapInBulletListCommand',
  orderedList: 'WrapInOrderedListCommand',
  blockquote: 'WrapInBlockquoteCommand',
  h1: 'TurnIntoHeadingCommand',
  h2: 'TurnIntoHeadingCommand',
  h3: 'TurnIntoHeadingCommand',
  hr: 'InsertHrCommand',
  table: 'InsertTableCommand'
}

// Fixed Toolbar Component with proper commands and icon styling
function FixedToolbar({ builder, onImageClick }: FixedToolbarProps) {
  const handleCommand = useCallback((command: string, payload?: any) => {
    if (!builder?.editor) {
      console.warn('Builder or editor not available')
      return
    }
    
    try {
      builder.editor.action((ctx: any) => {
        const commands = ctx.get(commandsCtx)
        const commandName = COMMAND_MAP[command as keyof typeof COMMAND_MAP]
        
        if (!commandName) {
          console.warn('Unknown command:', command)
          return
        }
        
        console.log('Executing command:', commandName, payload)
        
        if (payload) {
          commands.call(commandName, payload)
        } else {
          commands.call(commandName)
        }
      })
    } catch (error) {
      console.warn('Command execution failed:', command, error)
      
      // Fallback: try alternative command names
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
          }
        })
      } catch (fallbackError) {
        console.warn('Fallback command also failed:', command, fallbackError)
      }
    }
  }, [builder])

  const toolbarItems = [
    { icon: Bold, command: 'bold', label: 'Bold (Ctrl+B)' },
    { icon: Italic, command: 'italic', label: 'Italic (Ctrl+I)' },
    { icon: Strikethrough, command: 'strikethrough', label: 'Strikethrough' },
    { type: 'divider' },
    { icon: Heading1, command: 'h1', label: 'Heading 1', payload: { level: 1 } },
    { icon: Heading2, command: 'h2', label: 'Heading 2', payload: { level: 2 } },
    { icon: Heading3, command: 'h3', label: 'Heading 3', payload: { level: 3 } },
    { type: 'divider' },
    { icon: Code, command: 'code', label: 'Inline Code' },
    { icon: Link, command: 'link', label: 'Link (Ctrl+K)' },
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
    <div className="fixed-toolbar">
      {toolbarItems.map((item, index) => {
        if (item.type === 'divider') {
          return <div key={`divider-${index}`} className="toolbar-divider" />
        }

        const Icon = item.icon!
        return (
          <Button
            key={item.command}
            variant="ghost"
            size="sm"
            onClick={() => {
              if (item.command === 'image') {
                onImageClick()
              } else {
                handleCommand(item.command!, item.payload)
              }
            }}
            className="toolbar-button"
            title={item.label}
          >
            <Icon className="toolbar-icon" strokeWidth={1.5} />
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

  // Image management hook
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

  // Create the image select handler
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

  // Set up image block click interception
  useEffect(() => {
    if (isUnmountingRef.current) return
    
    const cleanup = setupImageBlockInterception(containerRef, isReady)
    return cleanup
  }, [setupImageBlockInterception, isReady])

  // Cleanup function
  const performCleanup = useCallback(() => {
    console.log('🧹 Starting UnifiedCrepeEditor cleanup...')
    isUnmountingRef.current = true
    
    cleanupContentSync()
    cleanupCollaboration()
    cleanupEditor()
    
    setPendingImageResolve(null)
    setCurrentImageBlock(null)
    
    console.log('✅ UnifiedCrepeEditor cleanup completed')
  }, [cleanupContentSync, cleanupCollaboration, cleanupEditor, setPendingImageResolve, setCurrentImageBlock])

  // Initialize editor
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setTimeout(() => {
        performCleanup()
      }, 0)
    }
  }, [performCleanup])

  // Public method to open image picker
  const openImagePicker = useCallback(() => {
    if (isUnmountingRef.current) return
    
    setShowImagePicker(true)
    if (onImageLibraryOpen) {
      onImageLibraryOpen()
    }
  }, [onImageLibraryOpen])

  // Expose the openImagePicker method
  useEffect(() => {
    if (containerRef.current && !isUnmountingRef.current) {
      (containerRef.current as any).openImagePicker = openImagePicker
    }
  }, [openImagePicker])

  const currentConnectionStatus = collaborative ? connectionStatus : 'solo'

  return (
    <div className="unified-crepe-editor">
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
        <div className="toolbar-container">
          <FixedToolbar 
            builder={builder} 
            onImageClick={handleToolbarImageClick}
          />
        </div>
      )}

      {/* Editor Container */}
      <div 
        ref={containerRef}
        className="editor-container"
        data-collaborative={collaborative}
        data-ready={isReady}
      />

      {/* Image Picker Dialog */}
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
        <div className="loading-overlay">
          <div className="loading-content">
            <div className={`loading-spinner ${collaborative ? 'collaborative' : 'solo'}`}></div>
            <div className="loading-title">
              Loading {collaborative ? 'Collaborative' : 'Solo'} Editor...
            </div>
            <div className="loading-description">
              {collaborative 
                ? 'Full Crepe features with real-time collaboration' 
                : 'Full Crepe features for single-user editing'
              }
            </div>
            <div className="loading-features">
              ✅ Unified Crepe editor • Auto-save {collaborative ? '1s' : '1.5s'} • 📸 Asset management
            </div>
          </div>
        </div>
      )}
    </div>
  )
}