// src/components/editor/ProperCollaborativeEditor.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Crepe } from '@milkdown/crepe'
import { collab, collabServiceCtx } from '@milkdown/plugin-collab'
import { Doc } from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/nord.css'

interface ProperCollaborativeEditorProps {
  documentId: string
  initialContent?: string
  onChange?: (markdown: string) => void
  onCollabReady?: () => void
}

export function ProperCollaborativeEditor({ 
  documentId, 
  initialContent = '', 
  onChange,
  onCollabReady 
}: ProperCollaborativeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Crepe | null>(null)
  const wsProviderRef = useRef<WebsocketProvider | null>(null)
  const docRef = useRef<Doc | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [collaborators, setCollaborators] = useState(1)
  const [hasCollabError, setHasCollabError] = useState(false)
  const changeHandler = useRef<() => void>()

  const cleanup = useCallback(() => {
    console.log(`🧹 Cleaning up collaborative editor for ${documentId}`)
    
    // Remove change listener
    if (changeHandler.current && docRef.current) {
      docRef.current.off('update', changeHandler.current)
    }

    // Disconnect WebSocket provider
    if (wsProviderRef.current) {
      try {
        wsProviderRef.current.disconnect()
        wsProviderRef.current.destroy()
      } catch (error) {
        console.error('Error destroying WebSocket provider:', error)
      }
      wsProviderRef.current = null
    }
    
    // Destroy Y.js document
    if (docRef.current) {
      try {
        docRef.current.destroy()
      } catch (error) {
        console.error('Error destroying Y.js document:', error)
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
  }, [documentId])

  const initializeEditor = useCallback(async () => {
    if (!containerRef.current || editorRef.current) {
      return
    }

    try {
      console.log(`🚀 Initializing collaborative editor for ${documentId}`)
      
      // Create Y.js document
      const doc = new Doc()
      docRef.current = doc

      // Create WebSocket provider
      const wsProvider = new WebsocketProvider(
        'ws://localhost:1234',
        documentId,
        doc,
        {
          connect: false, // Don't auto-connect
        }
      )
      wsProviderRef.current = wsProvider

      // Set up connection event handlers
      wsProvider.on('status', (event: { status: string }) => {
        console.log(`📡 WebSocket status for ${documentId}: ${event.status}`)
        setConnectionStatus(event.status === 'connected' ? 'connected' : 'connecting')
        
        if (event.status === 'connected') {
          setHasCollabError(false)
        }
      })

      // Track collaborators
      wsProvider.awareness.on('change', () => {
        const states = wsProvider.awareness.getStates()
        setCollaborators(Math.max(1, states.size))
        console.log(`👥 ${states.size} collaborators in ${documentId}`)
      })

      // Create Milkdown editor
      const editor = new Crepe({
        root: containerRef.current,
        defaultValue: initialContent,
        featureConfigs: {
          toolbar: {
            config: [
              'heading',
              'bold',
              'italic',
              'strike',
              'divider',
              'bullet_list',
              'ordered_list',
              'task_list',
              'divider',
              'code_inline',
              'code_block',
              'link',
              'image',
              'table',
              'divider',
              'quote'
            ]
          },
          preview: false,
        }
      })

      // Try to add collaboration plugin
      try {
        await editor.use(collab)
        console.log(`✅ Collaboration plugin loaded for ${documentId}`)
      } catch (error) {
        console.warn(`⚠️  Collaboration plugin failed, using fallback:`, error)
        setHasCollabError(true)
      }

      await editor.create()
      editorRef.current = editor
      console.log(`✅ Editor created for ${documentId}`)

      // Try to set up Y.js collaboration
      try {
        editor.action((ctx) => {
          const collabService = ctx.get(collabServiceCtx)

          collabService
            .bindDoc(doc)
            .setAwareness(wsProvider.awareness)

          // Wait for initial sync
          wsProvider.once('synced', async (isSynced: boolean) => {
            console.log(`🔄 Y.js sync for ${documentId}: ${isSynced}`)
            
            if (isSynced) {
              // Apply initial content only if document is empty
              if (initialContent && doc.getText().length === 0) {
                console.log(`📝 Applying initial content to ${documentId}`)
                collabService.applyTemplate(initialContent)
              }
              
              // Connect collaboration
              collabService.connect()
              setIsReady(true)
              onCollabReady?.()
              console.log(`🎉 Y.js collaboration ready for ${documentId}`)
            }
          })
        })

        // Connect WebSocket
        wsProvider.connect()
        
        // Timeout fallback - if collaboration doesn't work, just use regular editor
        setTimeout(() => {
          if (!isReady) {
            console.log(`⏰ Collaboration timeout for ${documentId}, using regular editor`)
            setIsReady(true)
            setHasCollabError(true)
            onCollabReady?.()
          }
        }, 5000)

      } catch (error) {
        console.warn(`⚠️  Y.js collaboration setup failed for ${documentId}:`, error)
        setHasCollabError(true)
        setIsReady(true)
        onCollabReady?.()
      }

      // Set up change detection for external onChange
      if (onChange) {
        changeHandler.current = () => {
          if (editorRef.current) {
            try {
              const content = editorRef.current.getMarkdown()
              onChange(content)
            } catch (error) {
              console.error('Error reading editor content:', error)
            }
          }
        }

        // Listen to Y.js document changes if available
        if (doc && !hasCollabError) {
          doc.on('update', changeHandler.current)
        } else {
          // Fallback to regular polling
          const interval = setInterval(changeHandler.current, 2000)
          return () => clearInterval(interval)
        }
      }

    } catch (error) {
      console.error(`❌ Failed to create collaborative editor for ${documentId}:`, error)
      setHasCollabError(true)
      
      // Try to create regular editor as fallback
      try {
        const editor = new Crepe({
          root: containerRef.current!,
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
        setIsReady(true)
        onCollabReady?.()
        console.log(`📝 Fallback editor ready for ${documentId}`)
      } catch (fallbackError) {
        console.error('❌ Even fallback editor failed:', fallbackError)
      }
    }
  }, [documentId, initialContent, onChange, onCollabReady, hasCollabError, isReady, cleanup])

  // Initialize on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeEditor()
    }, 100)

    return () => {
      clearTimeout(timer)
      cleanup()
    }
  }, [initializeEditor, cleanup])

  return (
    <div className="h-full w-full relative">
      {/* Status bar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30 text-sm">
        <div className="flex items-center gap-2">
          <div 
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' && !hasCollabError ? 'bg-green-500' : 
              connectionStatus === 'connecting' && !hasCollabError ? 'bg-yellow-500 animate-pulse' : 
              hasCollabError ? 'bg-orange-500' : 'bg-red-500'
            }`}
          />
          
          {hasCollabError ? (
            <span className="text-orange-600">Single-user mode</span>
          ) : (
            <span className="capitalize">{connectionStatus}</span>
          )}
          
          {connectionStatus === 'connected' && !hasCollabError && (
            <>
              <span className="text-green-600 font-medium">• Y.js Active</span>
              {collaborators > 1 && (
                <span className="text-blue-600">• {collaborators} users</span>
              )}
            </>
          )}
          
          {hasCollabError && (
            <span className="text-orange-600 text-xs">• Auto-save enabled</span>
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
              {hasCollabError ? 'Loading editor...' : 'Setting up Y.js collaboration...'}
            </div>
            <div className="text-xs mt-1 text-muted-foreground">
              {hasCollabError ? 'Fallback mode' : 'Connecting to collaborative server'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for managing collaborative documents
export function useProperCollaborativeDocument(documentId: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [document, setDocument] = useState<string>('')

  const handleCollabReady = useCallback(() => {
    setIsConnected(true)
  }, [])

  const handleDocumentChange = useCallback((content: string) => {
    setDocument(content)
  }, [])

  return {
    isConnected,
    collaborators: 1,
    document,
    handleCollabReady,
    handleDocumentChange
  }
}