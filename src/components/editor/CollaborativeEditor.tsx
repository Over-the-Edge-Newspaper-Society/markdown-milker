// src/components/editor/CollaborativeEditor.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/nord.css'

interface CollaborativeEditorProps {
  documentId: string
  initialContent?: string
  onChange?: (markdown: string) => void
  wsUrl?: string
}

// Dynamic imports to avoid Y.js conflicts
let Y: any = null
let WebsocketProvider: any = null
let collab: any = null
let collabServiceCtx: any = null

async function loadCollabDependencies() {
  if (Y && WebsocketProvider && collab && collabServiceCtx) {
    return { Y, WebsocketProvider, collab, collabServiceCtx }
  }

  try {
    console.log('📦 Loading Y.js and collaboration dependencies...')
    
    // Dynamic imports to avoid conflicts
    const [
      YModule,
      WebsocketModule,
      CollabModule
    ] = await Promise.all([
      import('yjs'),
      import('y-websocket'),
      import('@milkdown/plugin-collab')
    ])

    Y = YModule.Doc
    WebsocketProvider = WebsocketModule.WebsocketProvider
    collab = CollabModule.collab
    collabServiceCtx = CollabModule.collabServiceCtx

    console.log('✅ Y.js and collaboration dependencies loaded')
    
    return { Y, WebsocketProvider, collab, collabServiceCtx }
  } catch (error) {
    console.error('❌ Failed to load collaboration dependencies:', error)
    throw error
  }
}

export function CollaborativeEditor({ 
  documentId, 
  initialContent = '', 
  onChange,
  wsUrl = 'ws://localhost:1234'
}: CollaborativeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Crepe | null>(null)
  const docRef = useRef<any>(null)
  const providerRef = useRef<any>(null)
  const [isReady, setIsReady] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [collaborators, setCollaborators] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

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
    
    setIsReady(false)
    setConnectionStatus('disconnected')
    setHasError(false)
    setIsLoading(false)
  }, [documentId])

  const createFallbackEditor = useCallback(async () => {
    if (!containerRef.current) return

    try {
      console.log(`📝 Creating fallback editor for ${documentId}`)
      
      const editor = new Crepe({
        root: containerRef.current,
        defaultValue: initialContent,
        featureConfigs: {
          toolbar: {
            config: [
              'heading', 'bold', 'italic', 'strike', 'divider',
              'bullet_list', 'ordered_list', 'task_list', 'divider',
              'code_inline', 'code_block', 'link', 'image', 'table', 'divider', 'quote'
            ]
          },
          preview: false,
        }
      })
      
      await editor.create()
      editorRef.current = editor
      
      // Set up change detection for fallback editor
      if (onChange) {
        let lastContent = initialContent
        const checkForChanges = () => {
          if (editorRef.current) {
            try {
              const content = editorRef.current.getMarkdown()
              if (content !== lastContent) {
                lastContent = content
                onChange(content)
              }
            } catch (error) {
              console.error('Error getting markdown:', error)
            }
          }
        }
        
        // Poll for changes every 2 seconds
        const interval = setInterval(checkForChanges, 2000)
        
        // Cleanup interval on unmount
        return () => clearInterval(interval)
      }
      
      setIsReady(true)
      setHasError(true) // Mark as fallback mode
      setIsLoading(false)
      console.log(`✅ Fallback editor ready for ${documentId}`)
      
    } catch (error) {
      console.error('❌ Even fallback editor failed:', error)
      setIsLoading(false)
    }
  }, [documentId, initialContent, onChange])

  const initializeCollaborativeEditor = useCallback(async () => {
    if (!containerRef.current || editorRef.current) {
      return
    }

    try {
      setIsLoading(true)
      console.log(`🚀 Initializing collaborative editor for ${documentId}`)
      
      // Load dependencies dynamically
      const { Y: YDoc, WebsocketProvider: WSProvider, collab: collabPlugin, collabServiceCtx: collabService } = await loadCollabDependencies()
      
      // Create Y.js document
      const ydoc = new YDoc()
      docRef.current = ydoc

      // Create WebSocket provider
      const provider = new WSProvider(wsUrl, documentId, ydoc, {
        connect: false, // Don't auto-connect initially
      })
      providerRef.current = provider

      // Set up connection event handlers
      provider.on('status', (event: { status: string }) => {
        console.log(`📡 WebSocket status: ${event.status}`)
        setConnectionStatus(event.status === 'connected' ? 'connected' : 'connecting')
      })

      // Track collaborators via awareness
      provider.awareness.on('change', () => {
        const states = provider.awareness.getStates()
        setCollaborators(states.size)
        console.log(`👥 ${states.size} collaborators`)
      })

      // Create Crepe editor with collab plugin
      const editor = new Crepe({
        root: containerRef.current,
        defaultValue: initialContent,
        plugins: [collabPlugin],
        config: (ctx) => {
          // Configure the collaboration plugin
          ctx.set(collabPlugin.key, {
            yXmlFragment: ydoc.getXmlFragment('content'),
            awareness: provider.awareness,
          })
        },
        featureConfigs: {
          toolbar: {
            config: [
              'heading', 'bold', 'italic', 'strike', 'divider',
              'bullet_list', 'ordered_list', 'task_list', 'divider',
              'code_inline', 'code_block', 'link', 'image', 'table', 'divider', 'quote'
            ]
          },
          preview: false,
        }
      })

      await editor.create()
      editorRef.current = editor
      
      console.log(`✅ Collaborative editor created for ${documentId}`)

      // Set up change detection if onChange provided
      if (onChange) {
        const xmlFragment = ydoc.getXmlFragment('content')
        xmlFragment.observe(() => {
          if (editorRef.current) {
            try {
              const content = editorRef.current.getMarkdown()
              onChange(content)
            } catch (error) {
              console.error('Error getting markdown:', error)
            }
          }
        })
      }

      // Now connect the WebSocket
      provider.connect()
      
      setIsReady(true)
      setHasError(false)
      setIsLoading(false)

    } catch (error) {
      console.error(`❌ Failed to create collaborative editor:`, error)
      console.log('🔄 Falling back to single-user editor...')
      
      // Fallback to regular editor
      await createFallbackEditor()
    }
  }, [documentId, initialContent, onChange, wsUrl, createFallbackEditor])

  // Initialize on mount, cleanup on unmount
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeCollaborativeEditor()
    }, 100)
    
    return () => {
      clearTimeout(timer)
      cleanup()
    }
  }, [initializeCollaborativeEditor, cleanup])

  // Update content when prop changes (but avoid during collaboration)
  useEffect(() => {
    if (isReady && editorRef.current && initialContent && hasError) {
      // Only update in fallback mode
      try {
        const currentContent = editorRef.current.getMarkdown()
        if (currentContent !== initialContent) {
          editorRef.current.setMarkdown(initialContent)
        }
      } catch (error) {
        console.error('Error updating content:', error)
      }
    }
  }, [initialContent, isReady, hasError])

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
          
          {hasError && (
            <span className="text-orange-600 text-xs">• Collaboration disabled</span>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          {documentId}
        </div>
      </div>

      {/* Editor container */}
      <div 
        ref={containerRef}
        className="w-full"
        style={{ 
          height: 'calc(100% - 44px)',
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
              {hasError ? 'Will fallback to single-user mode' : 'Connecting to Y.js server'}
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
  const [content, setContent] = useState('')

  return {
    isConnected,
    content,
    setContent,
    documentId
  }
}