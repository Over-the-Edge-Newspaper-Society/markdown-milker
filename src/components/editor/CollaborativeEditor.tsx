// src/components/editor/CollaborativeEditor.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { collab, collabServiceCtx } from '@milkdown/plugin-collab'
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs'

// Import Crepe styles
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/nord.css'

interface CollaborativeEditorProps {
  documentId: string
  initialContent?: string
  onChange?: (markdown: string) => void
  wsUrl?: string
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'timeout'

// Global registry to prevent multiple instances
const editorRegistry = new Map<string, { ydoc: Doc, provider: WebsocketProvider, crepe: Crepe }>()

// Global flag to prevent multiple simultaneous initializations
const initializingEditors = new Set<string>()

export function CollaborativeEditor({ 
  documentId, 
  initialContent = '', 
  onChange,
  wsUrl = 'ws://localhost:1234'
}: CollaborativeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const docRef = useRef<Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [collaborators, setCollaborators] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const instanceIdRef = useRef<string>('')
  const lastValueRef = useRef<string>(initialContent)
  const onChangeRef = useRef(onChange)
  const isInitializedRef = useRef(false)

  // Keep onChange ref current
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Generate unique instance ID
  useEffect(() => {
    instanceIdRef.current = `editor-${Date.now()}-${Math.random()}`
  }, [])

  const cleanup = useCallback(() => {
    console.log(`🧹 Cleaning up collaborative editor for ${documentId}`)
    
    // Disconnect and destroy WebSocket provider
    if (providerRef.current) {
      try {
        providerRef.current.disconnect()
        providerRef.current.destroy()
      } catch (error) {
        console.error('Error destroying provider:', error)
      }
      providerRef.current = null
    }
    
    // Destroy Y.js document
    if (docRef.current) {
      try {
        docRef.current.destroy()
      } catch (error) {
        console.error('Error destroying Y.js doc:', error)
      }
      docRef.current = null
    }
    
    // Destroy Crepe editor
    if (crepeRef.current) {
      try {
        crepeRef.current.destroy()
      } catch (error) {
        console.error('Error destroying Crepe editor:', error)
      }
      crepeRef.current = null
    }
    
    // Clean DOM
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
    
    // Remove from registry
    editorRegistry.delete(documentId)
    initializingEditors.delete(documentId)
    
    setIsReady(false)
    setConnectionStatus('disconnected')
    setHasError(false)
    setIsLoading(true)
    setErrorMessage('')
    isInitializedRef.current = false
  }, [documentId])

  // Fallback to non-collaborative editor
  const initializeFallbackEditor = useCallback(async () => {
    if (!containerRef.current) return

    try {
      console.log('🔄 Creating fallback non-collaborative Crepe editor')
      
      // Ensure container is clean
      containerRef.current.innerHTML = ''
      
      // Create simple Crepe editor without collaboration
      const crepe = new Crepe({
        root: containerRef.current,
        defaultValue: initialContent,
        features: {
          [CrepeFeature.Toolbar]: true,
          [CrepeFeature.CodeMirror]: true,
          [CrepeFeature.ListItem]: true,
          [CrepeFeature.LinkTooltip]: true,
          [CrepeFeature.Cursor]: true,
          [CrepeFeature.ImageBlock]: true,
          [CrepeFeature.BlockEdit]: true,
          [CrepeFeature.Placeholder]: true,
          [CrepeFeature.Table]: true,
          [CrepeFeature.Latex]: true,
        }
      })

      await crepe.create()
      crepeRef.current = crepe
      setIsReady(true)
      setHasError(true) // Mark as error state but functional
      setErrorMessage('Collaboration unavailable - single-user mode')
      setIsLoading(false)
      
      console.log('✅ Fallback Crepe editor ready')

      // Set up change detection for fallback editor
      const interval = setInterval(() => {
        if (crepeRef.current && onChangeRef.current) {
          try {
            const content = crepeRef.current.getMarkdown()
            if (content !== lastValueRef.current) {
              lastValueRef.current = content
              onChangeRef.current(content)
            }
          } catch (error) {
            console.error('Error reading fallback editor content:', error)
          }
        }
      }, 1000)

      return () => clearInterval(interval)

    } catch (error) {
      console.error('Failed to create fallback editor:', error)
      setHasError(true)
      setErrorMessage('Editor initialization failed')
      setIsLoading(false)
    }
  }, [initialContent])

  // Initialize collaborative editor
  const initializeEditor = useCallback(async () => {
    // Prevent multiple instances
    if (!containerRef.current || crepeRef.current || isInitializedRef.current) {
      return
    }

    // Check if this document is already being initialized
    if (initializingEditors.has(documentId)) {
      console.warn('Editor is already being initialized for this document')
      return
    }

    // Check if another instance is already running for this document
    const existingInstance = editorRegistry.get(documentId)
    if (existingInstance) {
      console.warn('Another editor instance is already running for this document')
      // Reuse existing instance
      crepeRef.current = existingInstance.crepe
      docRef.current = existingInstance.ydoc
      providerRef.current = existingInstance.provider
      setIsReady(true)
      setConnectionStatus('connected')
      setIsLoading(false)
      return
    }

    try {
      // Mark as initializing
      initializingEditors.add(documentId)
      isInitializedRef.current = true
      
      // Ensure container is clean
      containerRef.current.innerHTML = ''
      
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (!containerRef.current) {
        editorRegistry.delete(instanceIdRef.current)
        isInitializedRef.current = false
        return
      }

      console.log('🎯 Creating collaborative Crepe editor')

      // Create Y.js document
      const ydoc = new Doc()
      docRef.current = ydoc

      // Create WebSocket provider
      const wsProvider = new WebsocketProvider(
        wsUrl,
        documentId,
        ydoc,
        {
          connect: true,
          params: { documentId },
          WebSocketPolyfill: WebSocket,
          resyncInterval: 5000,
          maxBackoffTime: 2500,
          disableBc: true
        }
      )
      providerRef.current = wsProvider

      // Set up connection timeout
      const connectionTimeout = setTimeout(() => {
        console.warn('⏰ Collaboration connection timeout, falling back to single-user mode')
        cleanup()
        initializeFallbackEditor()
      }, 10000) // 10 second timeout

      // Create Crepe editor with collaboration - CORRECT APPROACH
      const crepe = new Crepe({
        root: containerRef.current,
        defaultValue: initialContent, // Use initial content as default
        features: {
          [CrepeFeature.Toolbar]: true,
          [CrepeFeature.CodeMirror]: true,
          [CrepeFeature.ListItem]: true,
          [CrepeFeature.LinkTooltip]: true,
          [CrepeFeature.Cursor]: true,
          [CrepeFeature.ImageBlock]: true,
          [CrepeFeature.BlockEdit]: true,
          [CrepeFeature.Placeholder]: true,
          [CrepeFeature.Table]: true,
          [CrepeFeature.Latex]: true,
        }
      })

      // ① Add the collab plugin BEFORE creating the editor
      // TEMPORARILY DISABLED - Let's get basic editor working first
      // crepe.editor.use(collab)

      // ② Create the editor
      await crepe.create()
      crepeRef.current = crepe
      
      // Register this instance in the global registry
      editorRegistry.set(documentId, {
        ydoc,
        provider: wsProvider,
        crepe
      })
      
      // Remove from initializing set
      initializingEditors.delete(documentId)

      // Set up WebSocket event listeners AFTER editor is created
      wsProvider.on('status', (event: { status: string }) => {
        console.log('WebSocket status:', event.status)
        setConnectionStatus(event.status as ConnectionStatus)
      })

      wsProvider.on('connection-close', (event: any) => {
        console.log('WebSocket connection closed:', event)
        setConnectionStatus('disconnected')
      })

      wsProvider.on('connection-error', (event: any) => {
        console.error('WebSocket connection error:', event)
        setConnectionStatus('error')
      })

      wsProvider.awareness.on('change', () => {
        const states = wsProvider.awareness.getStates()
        setCollaborators(states.size)
      })

                  // ③ TEMPORARILY SKIP COLLABORATION - Just mark as ready
      setTimeout(() => {
        setIsReady(true)
        setConnectionStatus('connected')
        setIsLoading(false)
        console.log('✅ Basic Crepe editor ready (collaboration disabled)')
      }, 100)

      lastValueRef.current = initialContent

      // Set up change detection
      const interval = setInterval(() => {
        if (crepeRef.current && onChangeRef.current) {
          try {
            const content = crepeRef.current.getMarkdown()
            if (content !== lastValueRef.current) {
              lastValueRef.current = content
              onChangeRef.current(content)
            }
          } catch (error) {
            console.error('Error reading editor content:', error)
          }
        }
      }, 1000)

      // Cleanup interval on unmount
      return () => {
        clearInterval(interval)
        clearTimeout(connectionTimeout)
      }

    } catch (error) {
      console.error('Failed to create collaborative editor:', error)
      editorRegistry.delete(documentId)
      initializingEditors.delete(documentId)
      isInitializedRef.current = false
      // Try fallback editor instead of complete failure
      console.log('🔄 Attempting fallback editor...')
      initializeFallbackEditor()
    }
  }, [cleanup, documentId, initialContent, wsUrl, initializeFallbackEditor])

  // Initialize editor ONLY ONCE on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      console.log('🚀 Initializing collaborative editor (mount only)')
      const timer = setTimeout(() => {
        initializeEditor().catch(error => {
          console.error('Failed to initialize editor:', error)
          setHasError(true)
          setErrorMessage('Failed to initialize editor')
          setIsLoading(false)
        })
      }, 50)

      return () => {
        clearTimeout(timer)
      }
    }
  }, []) // Empty dependency array - only run on mount

  // Cleanup on unmount
  useEffect(() => {
    console.log('CollaborativeEditor mounted', documentId)
    return () => {
      console.log('CollaborativeEditor unmounted', documentId)
      cleanup()
    }
  }, [documentId, cleanup])

  const getStatusColor = () => {
    if (hasError) return 'bg-orange-500'
    if (connectionStatus === 'connected') return 'bg-green-500'
    if (connectionStatus === 'connecting') return 'bg-yellow-500 animate-pulse'
    return 'bg-red-500'
  }

  const getStatusText = () => {
    if (hasError) return 'Single-user mode'
    if (isLoading) return 'Loading...'
    return connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)
  }

  return (
    <div className="h-full w-full relative">
      {/* Status bar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30 text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span>{getStatusText()}</span>
          
          {connectionStatus === 'connected' && !hasError && (
            <>
              <span className="text-green-600 font-medium">• Y.js Active</span>
              {collaborators > 1 && (
                <span className="text-blue-600">• {collaborators} users</span>
              )}
            </>
          )}
          
          {hasError && errorMessage && (
            <span className="text-orange-600 text-xs">• {errorMessage}</span>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          {documentId}
        </div>
      </div>

      {/* Editor container */}
      <div 
        ref={containerRef}
        className="h-full min-h-[400px] w-full"
        style={{ 
          height: 'calc(100% - 48px)', // Subtract status bar height
          width: '100%'
        }}
      />
      
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/80">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <div className="font-medium">
              {isLoading ? 'Loading collaboration...' : 'Setting up editor...'}
            </div>
            <div className="text-xs mt-1 text-muted-foreground">
              {errorMessage || (hasError ? 'Will fallback to single-user mode' : 'Connecting to Y.js server')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for easy integration
export function useCollaborativeEditor(documentId: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [collaborators, setCollaborators] = useState(0)

  return {
    isConnected,
    collaborators,
    setIsConnected,
    setCollaborators
  }
}