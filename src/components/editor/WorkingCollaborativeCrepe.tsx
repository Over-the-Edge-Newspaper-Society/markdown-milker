// src/components/editor/WorkingCollaborativeCrepe.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CrepeBuilder } from '@milkdown/crepe/builder'
import { collab, collabServiceCtx } from '@milkdown/plugin-collab'
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs'

// Import all Crepe features manually
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

// Import Crepe styles to get the same look and feel
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

interface WorkingCollaborativeCrepeProps {
  documentId: string
  initialContent?: string
  onChange?: (markdown: string) => void
  wsUrl?: string
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'synced'

// Generate random color for user awareness
const randomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16)

export function WorkingCollaborativeCrepe({ 
  documentId, 
  initialContent = '', 
  onChange,
  wsUrl = 'ws://localhost:1234'
}: WorkingCollaborativeCrepeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const builderRef = useRef<CrepeBuilder | null>(null)
  const ydocRef = useRef<Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const onChangeRef = useRef(onChange)
  
  const [isReady, setIsReady] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [collaborators, setCollaborators] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [hasActiveCollaborators, setHasActiveCollaborators] = useState(false)
  const [saveCount, setSaveCount] = useState(0)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  
  const isInitializedRef = useRef(false)
  const lastSavedContentRef = useRef(initialContent)
  const initialContentAppliedRef = useRef(false)
  const isCurrentlySavingRef = useRef(false)

  // Keep onChange ref current
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up Collaborative Editor with File Persistence')
    
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current)
      saveIntervalRef.current = null
    }
    
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
    
    if (builderRef.current) {
      try {
        builderRef.current.destroy()
      } catch (error) {
        console.error('Error destroying builder:', error)
      }
      builderRef.current = null
    }
    
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
    
    setIsReady(false)
    setConnectionStatus('disconnected')
    setHasError(false)
    setIsLoading(true)
    setErrorMessage('')
    setSaveCount(0)
    setLastSaveTime(null)
    isInitializedRef.current = false
    initialContentAppliedRef.current = false
    isCurrentlySavingRef.current = false
  }, [])

  // ✅ SOLUTION 1: Smart content application that respects collaborative state
  const applyInitialContentSafely = useCallback(async (collabService: any) => {
    if (initialContentAppliedRef.current) {
      console.log('📋 Initial content already applied, skipping')
      return
    }

    // Check if there are active collaborators
    const currentCollaborators = providerRef.current?.awareness.getStates().size || 0
    
    if (currentCollaborators > 1) {
      console.log('👥 Multiple users detected - preserving collaborative state')
      initialContentAppliedRef.current = true
      return
    }

    // Check if Y.js document already has content
    if (ydocRef.current) {
      const yText = ydocRef.current.getText('milkdown')
      const existingContent = yText.toString()
      
      if (existingContent && existingContent.length > 0) {
        console.log('📄 Y.js document already has content, preserving it')
        console.log(`Existing: ${existingContent.length} chars vs File: ${initialContent.length} chars`)
        initialContentAppliedRef.current = true
        
        // Set the existing collaborative content as our baseline
        lastSavedContentRef.current = existingContent
        return
      }
    }

    // Only apply initial content if no collaborative state exists
    if (initialContent && initialContent.trim() !== '') {
      console.log('📋 Applying initial file content to empty collaborative document')
      try {
        await collabService.applyTemplate(initialContent, () => true)
        lastSavedContentRef.current = initialContent
        initialContentAppliedRef.current = true
      } catch (error) {
        console.error('Error applying initial content:', error)
      }
    } else {
      initialContentAppliedRef.current = true
    }
  }, [initialContent])

  // ✅ SOLUTION 2: Robust file persistence that actually saves
  const saveToFile = useCallback(async (content: string, forced: boolean = false) => {
    // Prevent concurrent saves
    if (isCurrentlySavingRef.current && !forced) {
      console.log('💾 Save already in progress, skipping...')
      return false
    }

    // Don't save if content hasn't changed (unless forced)
    if (content === lastSavedContentRef.current && !forced) {
      return false
    }

    // Don't save if we haven't applied initial content yet
    if (!initialContentAppliedRef.current && !forced) {
      console.log('💾 Initial content not applied yet, skipping save')
      return false
    }

    if (!onChangeRef.current) {
      console.log('💾 No onChange callback available')
      return false
    }

    try {
      isCurrentlySavingRef.current = true
      console.log('💾 SAVING collaborative content to file:', {
        contentLength: content.length,
        previousLength: lastSavedContentRef.current.length,
        forced
      })

      // Call the onChange callback which should trigger the file save
      await onChangeRef.current(content)
      
      lastSavedContentRef.current = content
      setSaveCount(prev => prev + 1)
      setLastSaveTime(new Date())
      
      console.log('✅ File save completed successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to save file:', error)
      return false
    } finally {
      isCurrentlySavingRef.current = false
    }
  }, [])

  // ✅ SOLUTION 3: Multiple methods to get content from the collaborative editor
  const getCollaborativeContent = useCallback((): string => {
    try {
      // Method 1: Try to get content from Crepe builder
      if (builderRef.current && typeof builderRef.current.getMarkdown === 'function') {
        const content = builderRef.current.getMarkdown()
        if (content && content.length > 0) {
          console.log('📄 Got content from Crepe builder:', content.length, 'chars')
          return content
        }
      }

      // Method 2: Try to get content directly from Y.js document
      if (ydocRef.current) {
        const yText = ydocRef.current.getText('milkdown')
        const content = yText.toString()
        if (content && content.length > 0) {
          console.log('📄 Got content from Y.js document:', content.length, 'chars')
          return content
        }
      }

      // Method 3: Try alternative Crepe methods
      if (builderRef.current) {
        const methods = ['getValue', 'getContent', 'getText']
        for (const method of methods) {
          if (typeof (builderRef.current as any)[method] === 'function') {
            try {
              const content = (builderRef.current as any)[method]()
              if (content && content.length > 0) {
                console.log(`📄 Got content from ${method}:`, content.length, 'chars')
                return content
              }
            } catch (e) {
              console.log(`Method ${method} failed:`, (e as Error).message)
            }
          }
        }
      }

      console.log('⚠️ No content found from any method')
      return ''
    } catch (error) {
      console.error('Error getting collaborative content:', error)
      return ''
    }
  }, [])

  // ✅ SOLUTION 4: Enhanced auto-save with multiple strategies
  const setupAutoSave = useCallback(() => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current)
    }

    console.log('💾 Setting up robust auto-save system...')

    saveIntervalRef.current = setInterval(async () => {
      if (!isReady || !initialContentAppliedRef.current) {
        return
      }

      try {
        const currentContent = getCollaborativeContent()
        
        if (currentContent && currentContent.length > 0) {
          const saveSuccessful = await saveToFile(currentContent)
          if (saveSuccessful) {
            console.log('💾 Auto-save successful:', currentContent.length, 'chars')
          }
        }
      } catch (error) {
        console.error('❌ Auto-save error:', error)
      }
    }, 1000) // Save every 1 second for frequent updates

    console.log('✅ Auto-save system configured (every 1 second)')
  }, [isReady, getCollaborativeContent, saveToFile])

  // ✅ SOLUTION 5: Additional Y.js document change listener
  const setupYjsChangeListener = useCallback(() => {
    if (!ydocRef.current) return

    console.log('📡 Setting up Y.js change listener for immediate saves...')

    // Listen for Y.js document updates
    ydocRef.current.on('update', async (update: Uint8Array, origin: any) => {
      // Only save if the update didn't come from us loading from file
      if (origin !== 'file-load' && initialContentAppliedRef.current) {
        console.log('📡 Y.js document updated, triggering save...')
        
        // Small delay to let the change propagate to the editor
        setTimeout(async () => {
          const content = getCollaborativeContent()
          if (content && content.length > 0) {
            await saveToFile(content)
          }
        }, 200)
      }
    })
  }, [getCollaborativeContent, saveToFile])

  const initializeEditor = useCallback(async () => {
    if (!containerRef.current || builderRef.current || isInitializedRef.current) {
      return
    }

    isInitializedRef.current = true
    
    try {
      // Ensure container is clean
      containerRef.current.innerHTML = ''
      
      console.log('🎯 Creating Collaborative Editor with File Persistence')

      // Create Y.js document and WebSocket provider FIRST
      const ydoc = new Doc()
      ydocRef.current = ydoc

      const provider = new WebsocketProvider(
        wsUrl,
        documentId,
        ydoc,
        { 
          connect: true,
          params: { documentId },
          resyncInterval: 2000,
          maxBackoffTime: 1000
        }
      )
      providerRef.current = provider

      // Set user awareness
      provider.awareness.setLocalStateField('user', {
        color: randomColor(),
        name: `User-${Math.floor(Math.random() * 1000)}`
      })

      // Set up event listeners
      provider.on('status', (payload: { status: string }) => {
        console.log('WebSocket status:', payload.status)
        setConnectionStatus(payload.status as ConnectionStatus)
      })

      provider.on('connection-close', () => {
        console.log('WebSocket connection closed')
        setConnectionStatus('disconnected')
      })

      provider.on('connection-error', (error: any) => {
        console.error('WebSocket connection error:', error)
        setConnectionStatus('error')
      })

      // Track collaborators
      provider.awareness.on('change', () => {
        const states = provider.awareness.getStates()
        const collaboratorCount = states.size
        setCollaborators(collaboratorCount)
        setHasActiveCollaborators(collaboratorCount > 1)
      })

      console.log('🎯 Creating CrepeBuilder with collaboration...')

      // Create CrepeBuilder - start with empty content
      const builder = new CrepeBuilder({
        root: containerRef.current,
        defaultValue: ''
      })

      console.log('✅ Adding collaboration plugin')
      builder.editor.use(collab)

      console.log('✅ Adding all Crepe features...')
      
      // Add all Crepe features
      builder.addFeature(cursor, { color: '#3b82f6', width: 2, virtual: true })
      builder.addFeature(listItem, {})
      builder.addFeature(linkTooltip, {})
      builder.addFeature(imageBlock, {
        onUpload: async (file: File) => {
          return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
        }
      })
      builder.addFeature(blockEdit, {})
      builder.addFeature(placeholder, { text: 'Start writing...', mode: 'block' })
      builder.addFeature(toolbar, {})
      builder.addFeature(codeMirror, {})
      builder.addFeature(table, {})
      builder.addFeature(latex, {})

      console.log('✅ Creating the collaborative editor...')
      await builder.create()
      builderRef.current = builder

      console.log('🎉 Collaborative editor created!')

      // Set up collaboration service
      builder.editor.action((ctx) => {
        const collabService = ctx.get(collabServiceCtx)
        
        // Bind collaboration
        collabService
          .bindDoc(ydoc)
          .setAwareness(provider.awareness)

        provider.once('synced', async (isSynced: boolean) => {
          console.log('Y.js synced:', isSynced)
          
          if (isSynced) {
            try {
              // Connect collaboration service
              await collabService.connect()
              
              // Wait for everything to stabilize
              setTimeout(async () => {
                // Apply initial content safely
                await applyInitialContentSafely(collabService)
                
                // Set up change listeners
                setupYjsChangeListener()
                
                // Start auto-save system
                setupAutoSave()
                
                setConnectionStatus('synced')
                setIsReady(true)
                setIsLoading(false)
                
                console.log('🎉 Collaborative editor with file persistence ready!')
                console.log('💾 Auto-save: Every 1 second + immediate on changes')
                
                // Force an initial save to establish baseline
                const initialContent = getCollaborativeContent()
                if (initialContent) {
                  await saveToFile(initialContent, true)
                }
              }, 500)
              
            } catch (syncError) {
              console.error('Error during sync:', syncError)
              setHasError(true)
              setErrorMessage('Sync failed')
              setIsLoading(false)
            }
          }
        })
      })

    } catch (error) {
      console.error('Failed to create collaborative editor:', error)
      setHasError(true)
      setErrorMessage('Failed to initialize collaborative editor')
      setIsLoading(false)
      isInitializedRef.current = false
    }
  }, [documentId, wsUrl, applyInitialContentSafely, setupAutoSave, setupYjsChangeListener, getCollaborativeContent, saveToFile])

  // Initialize editor on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      console.log('🚀 Initializing Collaborative Editor with File Persistence')
      const timer = setTimeout(() => {
        initializeEditor().catch(error => {
          console.error('Failed to initialize collaborative editor:', error)
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
      console.log('🧹 Collaborative Editor with File Persistence unmounting')
      cleanup()
    }
  }, [cleanup])

  // Force save on beforeunload
  useEffect(() => {
    const handleBeforeUnload = async () => {
      const content = getCollaborativeContent()
      if (content) {
        await saveToFile(content, true)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [getCollaborativeContent, saveToFile])

  const getStatusColor = () => {
    if (hasError) return 'bg-red-500'
    if (connectionStatus === 'synced') return 'bg-green-500'
    if (connectionStatus === 'connected') return 'bg-blue-500'
    if (connectionStatus === 'connecting') return 'bg-yellow-500 animate-pulse'
    return 'bg-red-500'
  }

  const getStatusText = () => {
    if (hasError) return `Error: ${errorMessage}`
    if (isLoading) return 'Loading...'
    if (connectionStatus === 'synced') return 'Collaborative Editor with File Persistence'
    return 'Connecting...'
  }

  return (
    <div className="h-full w-full relative">
      {/* Enhanced status bar with save information */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30 text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span>{getStatusText()}</span>
          
          {connectionStatus === 'synced' && !hasError && (
            <>
              {collaborators > 1 && (
                <span className="text-purple-600">• {collaborators} users</span>
              )}
              <span className="text-green-600 text-xs">
                • {saveCount} saves
              </span>
              {lastSaveTime && (
                <span className="text-blue-600 text-xs">
                  • Last: {lastSaveTime.toLocaleTimeString()}
                </span>
              )}
              <span className="text-orange-600 text-xs">• Auto-save 1s</span>
            </>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          {documentId} • File Persistence
        </div>
      </div>

      {/* Editor container */}
      <div 
        ref={containerRef}
        className="h-full w-full"
        style={{ 
          height: 'calc(100% - 48px)',
          width: '100%'
        }}
      />
      
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/80">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <div className="font-medium">
              {isLoading ? 'Loading Collaborative Editor...' : 'Preparing editor...'}
            </div>
            <div className="text-xs mt-1 text-muted-foreground">
              Collaborative editing with automatic file persistence
            </div>
            <div className="text-xs text-green-600 mt-1">
              ✅ Saves to file every second + on changes
            </div>
            <div className="text-xs text-blue-600 mt-1">
              ✅ Preserves work on server restart
            </div>
          </div>
        </div>
      )}
    </div>
  )
}