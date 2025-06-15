// src/components/editor/CrepeCollaborativeEditor.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { defaultValueCtx, Editor, rootCtx } from '@milkdown/kit/core'
import { collab, collabServiceCtx } from '@milkdown/plugin-collab'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs'

// Import Crepe styles to get the same look and feel
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

interface CrepeCollaborativeEditorProps {
  documentId: string
  initialContent?: string
  onChange?: (markdown: string) => void
  wsUrl?: string
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'synced'

// Generate random color for user awareness
const randomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16)

// User options for awareness
const userOptions = [
  { color: randomColor(), name: `User-${Math.floor(Math.random() * 1000)}` }
]

export function CrepeCollaborativeEditor({ 
  documentId, 
  initialContent = '', 
  onChange,
  wsUrl = 'ws://localhost:1234'
}: CrepeCollaborativeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const docRef = useRef<Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [collaborators, setCollaborators] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const isInitializedRef = useRef(false)
  const lastContentRef = useRef<string>(initialContent)
  const onChangeRef = useRef(onChange)

  // Keep onChange ref current
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up Crepe collaborative editor')
    
    if (providerRef.current) {
      try {
        providerRef.current.disconnect()
        providerRef.current.destroy()
      } catch (error) {
        console.error('Error destroying provider:', error)
      }
      providerRef.current = null
    }
    
    if (docRef.current) {
      try {
        docRef.current.destroy()
      } catch (error) {
        console.error('Error destroying Y.js doc:', error)
      }
      docRef.current = null
    }
    
    if (editorRef.current) {
      try {
        editorRef.current.destroy()
      } catch (error) {
        console.error('Error destroying editor:', error)
      }
      editorRef.current = null
    }
    
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
    
    setIsReady(false)
    setConnectionStatus('disconnected')
    setHasError(false)
    setIsLoading(true)
    setErrorMessage('')
    isInitializedRef.current = false
  }, [])

  // Enhanced editor configuration with Crepe-like features
  const createCrepeStyledEditor = useCallback(async () => {
    if (!containerRef.current) return null

    // Create the main editor container with Crepe styling
    const editorContainer = document.createElement('div')
    editorContainer.className = 'crepe-editor-container'
    
    // Add Crepe-like styling
    editorContainer.style.cssText = `
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    `

    // Create toolbar container
    const toolbarContainer = document.createElement('div')
    toolbarContainer.className = 'crepe-toolbar'
    toolbarContainer.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
      border-radius: 8px 8px 0 0;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    `

    // Create toolbar buttons with Crepe styling
    const toolbarButtons = [
      { icon: '𝐁', title: 'Bold', action: 'bold' },
      { icon: '𝐼', title: 'Italic', action: 'italic' },
      { icon: '≡', title: 'Heading', action: 'heading' },
      { icon: '•', title: 'Bullet List', action: 'bullet_list' },
      { icon: '1.', title: 'Ordered List', action: 'ordered_list' },
      { icon: '💬', title: 'Quote', action: 'quote' },
      { icon: '{ }', title: 'Code', action: 'code' },
      { icon: '🔗', title: 'Link', action: 'link' },
    ]

    toolbarButtons.forEach(({ icon, title, action }) => {
      const button = document.createElement('button')
      button.innerHTML = icon
      button.title = title
      button.style.cssText = `
        padding: 6px 8px;
        border: 1px solid #d1d5db;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        min-width: 32px;
        height: 32px;
      `
      
      button.addEventListener('mouseenter', () => {
        button.style.background = '#f3f4f6'
        button.style.borderColor = '#9ca3af'
      })
      
      button.addEventListener('mouseleave', () => {
        button.style.background = 'white'
        button.style.borderColor = '#d1d5db'
      })
      
      // TODO: Add actual formatting functionality
      button.addEventListener('click', () => {
        console.log(`Toolbar action: ${action}`)
        // You can implement formatting actions here
      })
      
      toolbarContainer.appendChild(button)
    })

    // Create editor content area
    const editorContent = document.createElement('div')
    editorContent.className = 'crepe-editor-content'
    editorContent.style.cssText = `
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      min-height: 400px;
    `

    // Assemble the editor
    editorContainer.appendChild(toolbarContainer)
    editorContainer.appendChild(editorContent)
    containerRef.current.appendChild(editorContainer)

    // Create Milkdown editor in the content area
    const editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, editorContent)
        ctx.set(defaultValueCtx, '')
      })
      .config((ctx) => {
        // Add Crepe-like styling configuration
        ctx.update(rootCtx, (prev) => {
          const root = prev as HTMLElement
          root.style.cssText += `
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #374151;
            outline: none;
            min-height: 350px;
          `
          return root
        })
      })
      .use(commonmark)
      .use(collab)
      .create()

    return editor
  }, [])

  // Create collaborative manager
  const createCollaborativeManager = useCallback((editor: Editor, collabService: any) => {
    const ydoc = new Doc()
    docRef.current = ydoc

    const provider = new WebsocketProvider(
      wsUrl,
      documentId,
      ydoc,
      { 
        connect: true,
        params: { documentId },
        resyncInterval: 5000,
        maxBackoffTime: 1000, // Faster backoff
        maxReconnectTimeout: 5000 // Max timeout for reconnect
      }
    )
    providerRef.current = provider

    // Track connection failures for faster fallback
    let connectionAttempts = 0
    const maxAttempts = 3

    // Add connection timeout
    const connectionTimeout = setTimeout(() => {
      console.warn('⏰ Crepe collab connection timeout, using single-user mode')
      setHasError(true)
      setErrorMessage('Connection timeout - single-user mode')
      setIsReady(true)
      setIsLoading(false)
    }, 5000) // 5 second timeout

    // Set user awareness with Crepe-like colors
    provider.awareness.setLocalStateField('user', {
      ...userOptions[0],
      color: randomColor()
    })

    // Set up WebSocket event listeners
    provider.on('status', (payload: { status: string }) => {
      console.log('WebSocket status:', payload.status)
      setConnectionStatus(payload.status as ConnectionStatus)
    })

    provider.on('connection-close', () => {
      console.log('WebSocket connection closed')
      setConnectionStatus('disconnected')
      connectionAttempts++
      
      if (connectionAttempts >= maxAttempts) {
        console.warn(`💥 Crepe collab: Too many connection failures, falling back`)
        clearTimeout(connectionTimeout)
        setHasError(true)
        setErrorMessage('Connection failed - using single-user mode')
        setIsReady(true)
        setIsLoading(false)
      }
    })

    provider.on('connection-error', (error: any) => {
      console.error('WebSocket connection error:', error)
      setConnectionStatus('error')
      connectionAttempts++
      
      if (connectionAttempts >= maxAttempts) {
        console.warn(`💥 Crepe collab: Too many connection errors, falling back`)
        clearTimeout(connectionTimeout)
        setHasError(true)
        setErrorMessage('Connection failed - using single-user mode')
        setIsReady(true)
        setIsLoading(false)
      }
    })

    // Track collaborators
    provider.awareness.on('change', () => {
      const states = provider.awareness.getStates()
      setCollaborators(states.size)
    })

    // Bind collaboration service
    collabService
      .bindDoc(ydoc)
      .setAwareness(provider.awareness)

    // Wait for initial sync, then apply content
    provider.once('synced', async (isSynced: boolean) => {
      console.log('Y.js synced:', isSynced)
      
      if (isSynced) {
        try {
          console.log('Applying initial content via collabService for Crepe:', initialContent.substring(0, 50) + '...')
          
          // Simply apply the initial content - Y.js will handle merging
          if (initialContent && initialContent.trim() !== '') {
            await collabService.applyTemplate(initialContent, () => true)
          }
          
          await collabService.connect()
          setConnectionStatus('synced')
          setIsReady(true)
          setIsLoading(false)
          
          // Clear timeout since we succeeded
          clearTimeout(connectionTimeout)
          
          console.log('✅ Crepe collaborative editor ready and synced')
        } catch (error) {
          console.error('Error during sync setup:', error)
          setHasError(true)
          setErrorMessage('Sync failed')
          setIsLoading(false)
        }
      }
    })

    return {
      connect: () => {
        provider.connect()
        collabService.connect()
      },
      disconnect: () => {
        collabService.disconnect()
        provider.disconnect()
      },
      applyTemplate: (content: string) => {
        collabService
          .disconnect()
          .applyTemplate(content, () => true)
          .connect()
      }
    }
  }, [documentId, initialContent, wsUrl])

  // Initialize Crepe-styled collaborative editor
  const initializeEditor = useCallback(async () => {
    if (!containerRef.current || editorRef.current || isInitializedRef.current) {
      return
    }

    try {
      isInitializedRef.current = true
      
      // Ensure container is clean
      containerRef.current.innerHTML = ''
      
      console.log('🎯 Creating Crepe-styled collaborative editor')

      // Create the styled editor
      const editor = await createCrepeStyledEditor()
      if (!editor) {
        throw new Error('Failed to create editor')
      }

      editorRef.current = editor
      
      // Set up collaboration
      editor.action((ctx) => {
        const collabService = ctx.get(collabServiceCtx)
        const manager = createCollaborativeManager(editor, collabService)
        
        // Store manager methods for potential external use
        ;(editor as any).collabManager = manager
      })

      // Set up content change detection with Crepe-like behavior
      const interval = setInterval(() => {
        if (editorRef.current && isReady && onChangeRef.current) {
          try {
            editorRef.current.action(ctx => {
              try {
                // Get the current markdown content from the editor
                const markdown = ctx.get(defaultValueCtx) || ''
                
                if (markdown !== lastContentRef.current) {
                  lastContentRef.current = markdown
                  if (onChangeRef.current) {
                    onChangeRef.current(markdown)
                  }
                }
              } catch (error) {
                console.error('Error getting markdown from editor:', error)
              }
            })
          } catch (error) {
            console.error('Error in content change detection:', error)
          }
        }
      }, 2000)

      return () => clearInterval(interval)

    } catch (error) {
      console.error('Failed to create Crepe collaborative editor:', error)
      setHasError(true)
      setErrorMessage('Failed to initialize editor')
      setIsLoading(false)
      isInitializedRef.current = false
    }
  }, [createCrepeStyledEditor, createCollaborativeManager, isReady])

  // Initialize editor on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      console.log('🚀 Initializing Crepe-styled collaborative editor')
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
  }, [initializeEditor])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up Crepe collaborative editor (unmount)')
      cleanup()
    }
  }, [cleanup])

  const getStatusColor = () => {
    if (hasError) return 'bg-red-500'
    if (connectionStatus === 'synced' || connectionStatus === 'connected') return 'bg-green-500'
    if (connectionStatus === 'connecting') return 'bg-yellow-500 animate-pulse'
    return 'bg-red-500'
  }

  const getStatusText = () => {
    if (hasError) return `Error: ${errorMessage}`
    if (isLoading) return 'Loading...'
    if (connectionStatus === 'synced') return 'Synced'
    return connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)
  }

  return (
    <div className="h-full w-full relative">
      {/* Status bar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30 text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span>{getStatusText()}</span>
          
          {(connectionStatus === 'connected' || connectionStatus === 'synced') && !hasError && (
            <>
              <span className="text-green-600 font-medium">• Crepe Collaborative</span>
              {collaborators > 1 && (
                <span className="text-blue-600">• {collaborators} users</span>
              )}
            </>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          {documentId}
        </div>
      </div>

      {/* Editor container */}
      <div 
        ref={containerRef}
        className="h-full w-full"
        style={{ 
          height: 'calc(100% - 48px)', // Subtract status bar height
          width: '100%',
          padding: '16px'
        }}
      />
      
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/80">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <div className="font-medium">
              {isLoading ? 'Setting up Crepe collaboration...' : 'Preparing editor...'}
            </div>
            <div className="text-xs mt-1 text-muted-foreground">
              {errorMessage || 'Creating beautiful collaborative editor'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}