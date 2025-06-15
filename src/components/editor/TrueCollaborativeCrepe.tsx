// src/components/editor/TrueCollaborativeCrepe.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'  
import { collab, collabServiceCtx } from '@milkdown/plugin-collab'
import { trailing } from '@milkdown/plugin-trailing'
import { cursor } from '@milkdown/plugin-cursor'
import { clipboard } from '@milkdown/plugin-clipboard'
import { history } from '@milkdown/plugin-history'
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs'
import { ExtendedCrepeEditorProps, ConnectionStatus } from '@/types/editor'

// Generate random color for user awareness
const randomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16)

export function TrueCollaborativeCrepe({ 
  documentId, 
  initialContent = '', 
  onChange,
  wsUrl = 'ws://localhost:1234'
}: ExtendedCrepeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const ydocRef = useRef<Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  
  const [isReady, setIsReady] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [collaborators, setCollaborators] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>('')
  
  const isInitializedRef = useRef(false)
  const onChangeRef = useRef(onChange)

  // Keep onChange ref current
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up True Collaborative Crepe')
    
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

  const initializeEditor = useCallback(async () => {
    if (!containerRef.current || editorRef.current || isInitializedRef.current) {
      return
    }

    isInitializedRef.current = true
    
    try {
      // Ensure container is clean
      containerRef.current.innerHTML = ''
      
      console.log('🎯 Creating TRUE collaborative Crepe editor from scratch')

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
          resyncInterval: 5000,
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
        setCollaborators(states.size)
      })

      // Create editor container with Crepe-like styling
      const editorContainer = document.createElement('div')
      editorContainer.className = 'true-collaborative-crepe'
      editorContainer.style.cssText = `
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #ffffff;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `

      // Create toolbar
      const toolbar = document.createElement('div')
      toolbar.className = 'collaborative-toolbar'
      toolbar.style.cssText = `
        padding: 12px 16px;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
        border-radius: 8px 8px 0 0;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      `

      // Add toolbar buttons
      const toolbarButtons = [
        { text: 'H1', action: () => insertText('# ') },
        { text: 'H2', action: () => insertText('## ') },
        { text: 'B', action: () => wrapText('**', '**') },
        { text: 'I', action: () => wrapText('_', '_') },
        { text: '•', action: () => insertText('- ') },
        { text: '1.', action: () => insertText('1. ') },
        { text: 'Code', action: () => wrapText('`', '`') },
        { text: 'Link', action: () => wrapText('[', '](url)') },
      ]

      toolbarButtons.forEach(({ text, action }) => {
        const button = document.createElement('button')
        button.textContent = text
        button.style.cssText = `
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        `
        
        button.addEventListener('mouseenter', () => {
          button.style.background = '#f3f4f6'
          button.style.borderColor = '#9ca3af'
        })
        
        button.addEventListener('mouseleave', () => {
          button.style.background = 'white'
          button.style.borderColor = '#d1d5db'
        })
        
        button.addEventListener('click', action)
        toolbar.appendChild(button)
      })

      // Create editor content area
      const editorContent = document.createElement('div')
      editorContent.className = 'collaborative-editor-content'
      editorContent.style.cssText = `
        flex: 1;
        padding: 24px;
        overflow-y: auto;
        min-height: 400px;
      `

      // Assemble the editor UI
      editorContainer.appendChild(toolbar)
      editorContainer.appendChild(editorContent)
      containerRef.current.appendChild(editorContainer)

      console.log('🎯 Building Milkdown editor WITH collaboration from the start...')

      // Create Milkdown editor with ALL plugins from the beginning (including collab)
      const editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, editorContent)
          ctx.set(defaultValueCtx, initialContent)
        })
        .use(commonmark)
        .use(gfm)
        .use(trailing)
        .use(cursor)
        .use(clipboard) 
        .use(history)
        .use(collab) // ✅ Added during creation - this WILL work!
        .create()

      editorRef.current = editor

      console.log('✅ Milkdown editor created with collaboration support!')

      // Set up collaboration service
      editor.action((ctx) => {
        const collabService = ctx.get(collabServiceCtx)
        
        // Bind collaboration
        collabService
          .bindDoc(ydoc)
          .setAwareness(provider.awareness)

        // Wait for sync
        provider.once('synced', async (isSynced: boolean) => {
          console.log('Y.js synced:', isSynced)
          
          if (isSynced) {
            try {
              // Apply initial content if needed
              if (initialContent && initialContent.trim() !== '') {
                await collabService.applyTemplate(initialContent, () => true)
              }
              
              await collabService.connect()
              setConnectionStatus('synced')
              setIsReady(true)
              setIsLoading(false)
              
              console.log('🎉 TRUE collaborative Crepe editor ready!')
              
            } catch (syncError) {
              console.error('Error during sync:', syncError)
              setHasError(true)
              setErrorMessage('Sync failed')
              setIsLoading(false)
            }
          }
        })
      })

      // Helper functions for toolbar
      function insertText(text: string) {
        if (editorRef.current) {
          // This would need proper ProseMirror commands for real implementation
          console.log('Insert text:', text)
        }
      }

      function wrapText(before: string, after: string) {
        if (editorRef.current) {
          // This would need proper ProseMirror commands for real implementation  
          console.log('Wrap text:', before, after)
        }
      }

      // Set up content change detection
      const interval = setInterval(() => {
        if (editorRef.current && isReady && onChangeRef.current) {
          try {
            editorRef.current.action((ctx) => {
              const content = ctx.get(defaultValueCtx) || ''
              if (onChangeRef.current) {
                onChangeRef.current(content)
              }
            })
          } catch (error) {
            console.error('Error reading content:', error)
          }
        }
      }, 2000)

      return () => clearInterval(interval)

    } catch (error) {
      console.error('Failed to create TRUE collaborative Crepe editor:', error)
      setHasError(true)
      setErrorMessage('Failed to initialize collaborative editor')
      setIsLoading(false)
      isInitializedRef.current = false
    }
  }, [documentId, initialContent, wsUrl])

  // Initialize editor on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      console.log('🚀 Initializing TRUE Collaborative Crepe Editor')
      const timer = setTimeout(() => {
        initializeEditor().catch(error => {
          console.error('Failed to initialize TRUE collaborative editor:', error)
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
      console.log('🧹 TRUE Collaborative Crepe unmounting')
      cleanup()
    }
  }, [cleanup])

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
    if (connectionStatus === 'synced') return 'True Collaborative Crepe'
    return 'Connecting...'
  }

  return (
    <div className="h-full w-full relative">
      {/* Status bar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30 text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span>{getStatusText()}</span>
          
          {connectionStatus === 'synced' && !hasError && (
            <>
              <span className="text-green-600 font-medium">• Real-time Sync</span>
              {collaborators > 1 && (
                <span className="text-blue-600">• {collaborators} users</span>
              )}
            </>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          {documentId} • Collaborative
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
              {isLoading ? 'Building collaborative editor...' : 'Preparing editor...'}
            </div>
            <div className="text-xs mt-1 text-muted-foreground">
              Creating Milkdown + Y.js from scratch
            </div>
            <div className="text-xs text-green-600 mt-1">
              True real-time collaboration
            </div>
          </div>
        </div>
      )}
    </div>
  )
}