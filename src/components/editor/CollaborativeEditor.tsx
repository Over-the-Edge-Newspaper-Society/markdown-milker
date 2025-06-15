// src/components/editor/CollaborativeEditor.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { nord } from '@milkdown/theme-nord'
import { collab, collabServiceCtx, CollabService } from '@milkdown/plugin-collab'
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs'

interface CollaborativeEditorProps {
  documentId: string
  initialContent?: string
  onChange?: (markdown: string) => void
  wsUrl?: string
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'timeout'

// Global registry to prevent multiple instances
const editorRegistry = new Set<string>()

export function CollaborativeEditor({ 
  documentId, 
  initialContent = '', 
  onChange,
  wsUrl = 'ws://localhost:1234'
}: CollaborativeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const docRef = useRef<Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const collabServiceRef = useRef<CollabService | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [collaborators, setCollaborators] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const instanceIdRef = useRef<string>('')
  const lastValueRef = useRef<string>(initialContent)
  const onChangeRef = useRef(onChange)

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
    
    // Disconnect collaboration service
    if (collabServiceRef.current) {
      try {
        collabServiceRef.current.disconnect()
      } catch (error) {
        console.error('Error disconnecting collab service:', error)
      }
      collabServiceRef.current = null
    }
    
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
    
    // Destroy editor
    if (editorRef.current) {
      try {
        editorRef.current.destroy()
      } catch (error) {
        console.error('Error destroying editor:', error)
      }
      editorRef.current = null
    }
    
    // Clean DOM
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
    
    // Remove from registry
    if (instanceIdRef.current) {
      editorRegistry.delete(instanceIdRef.current)
    }
    
    setIsReady(false)
    setConnectionStatus('disconnected')
    setHasError(false)
    setIsLoading(true)
    setErrorMessage('')
  }, [documentId])

  // Fallback to non-collaborative editor
  const initializeFallbackEditor = useCallback(async () => {
    if (!containerRef.current) return

    try {
      console.log('🔄 Creating fallback non-collaborative editor')
      
      // Ensure container is clean
      containerRef.current.innerHTML = ''
      
      // Create simple Milkdown editor without collaboration
      const editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, containerRef.current)
          ctx.set(defaultValueCtx, initialContent)
        })
        .config(nord)
        .use(commonmark)
        .create()

      editorRef.current = editor
      setIsReady(true)
      setHasError(true) // Mark as error state but functional
      setErrorMessage('Collaboration unavailable - single-user mode')
      setIsLoading(false)
      
      console.log('✅ Fallback editor ready')

      // Set up change detection for fallback editor
      const interval = setInterval(() => {
        if (editorRef.current && onChangeRef.current) {
          try {
            // For now, we'll use a simple approach
            // In a real implementation, you'd want to properly get the markdown content
            const content = lastValueRef.current
            if (content !== lastValueRef.current) {
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

  // Initialize editor ONLY ONCE
  const initializeEditor = useCallback(async () => {
    // Prevent multiple instances
    if (!containerRef.current || editorRef.current) {
      return
    }

    // Check if another instance is already running
    if (editorRegistry.size > 0) {
      console.warn('Another editor instance is already running')
      return
    }

    try {
      // Register this instance
      editorRegistry.add(instanceIdRef.current)
      
      // Ensure container is clean
      containerRef.current.innerHTML = ''
      
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (!containerRef.current) {
        editorRegistry.delete(instanceIdRef.current)
        return
      }

      console.log('🎯 Creating collaborative editor (one time only)')

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

      // Set up WebSocket event listeners
      wsProvider.on('status', (event: { status: string }) => {
        console.log('WebSocket status:', event.status)
        setConnectionStatus(event.status as ConnectionStatus)
        if (event.status === 'connected') {
          setIsLoading(false)
        }
      })

      wsProvider.awareness.on('change', () => {
        const states = wsProvider.awareness.getStates()
        setCollaborators(states.size)
      })

      // Set up connection timeout
      const connectionTimeout = setTimeout(() => {
        if (connectionStatus !== 'connected') {
          console.warn('⏰ Collaboration connection timeout, falling back to single-user mode')
          cleanup()
          initializeFallbackEditor()
        }
      }, 10000) // 10 second timeout

      // Create Milkdown editor with collaboration
      const editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, containerRef.current)
          ctx.set(defaultValueCtx, initialContent)
        })
        .config(nord)
        .use(commonmark)
        .use(collab)
        .create()

      editorRef.current = editor

      // Set up collaboration after editor is created
      editor.action((ctx) => {
        const collabService = ctx.get(collabServiceCtx)
        collabServiceRef.current = collabService

        collabService
          .bindDoc(ydoc)
          .setAwareness(wsProvider.awareness)

        // Wait for initial sync before connecting
        wsProvider.once('synced', (isSynced: boolean) => {
          clearTimeout(connectionTimeout)
          if (isSynced) {
            collabService.applyTemplate(initialContent).connect()
            setIsReady(true)
            setConnectionStatus('connected')
            setIsLoading(false)
            console.log('✅ Collaborative editor ready')
          }
        })
      })

      lastValueRef.current = initialContent

      // Set up change detection
      const interval = setInterval(() => {
        if (editorRef.current) {
          try {
            // Note: Getting markdown from Milkdown editor requires different approach
            // This is a simplified version - you may need to implement proper change detection
            const content = lastValueRef.current // Placeholder for now
            if (onChangeRef.current && content !== lastValueRef.current) {
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
      console.error('Failed to create editor:', error)
      editorRegistry.delete(instanceIdRef.current)
      // Try fallback editor instead of complete failure
      console.log('🔄 Attempting fallback editor...')
      initializeFallbackEditor()
    }
  }, [cleanup, documentId, initialContent, wsUrl, initializeFallbackEditor])

  // Initialize editor ONLY ONCE on mount
  useEffect(() => {
    console.log('🚀 Initializing editor (mount only)')
    const timer = setTimeout(() => {
      initializeEditor().catch(error => {
        console.error('Failed to initialize editor:', error)
        setHasError(true)
        setErrorMessage('Failed to initialize editor')
        setIsLoading(false)
      })
    }, 50)

    return () => {
      console.log('🧹 Cleaning up editor (unmount only)')
      clearTimeout(timer)
      cleanup()
    }
  }, []) // Empty dependency array = run only on mount/unmount

  // Handle content updates separately
  useEffect(() => {
    if (isReady && collabServiceRef.current && initialContent !== lastValueRef.current) {
      try {
        console.log('📝 Updating content smoothly (no remount)')
        collabServiceRef.current
          .disconnect()
          .applyTemplate(initialContent, () => true)
          .connect()
        lastValueRef.current = initialContent
      } catch (error) {
        console.error('Error setting editor content:', error)
      }
    }
  }, [initialContent, isReady])

  useEffect(() => {
    console.log('CollaborativeEditor mounted', documentId)
    return () => {
      console.log('CollaborativeEditor unmounted', documentId)
    }
  }, [documentId])

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
        className="h-full min-h-[400px] w-full prose prose-sm max-w-none p-4"
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