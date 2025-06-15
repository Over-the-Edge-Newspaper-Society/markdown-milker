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
    console.log('🧹 Cleaning up Full-Featured Collaborative Crepe')
    
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
    isInitializedRef.current = false
  }, [])

  const initializeEditor = useCallback(async () => {
    if (!containerRef.current || builderRef.current || isInitializedRef.current) {
      return
    }

    isInitializedRef.current = true
    
    try {
      // Ensure container is clean
      containerRef.current.innerHTML = ''
      
      console.log('🎯 Creating FULL-FEATURED collaborative Crepe editor')

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

      console.log('🎯 Creating CrepeBuilder with ALL Crepe features + collaboration...')

      // ✅ Step 1: Create CrepeBuilder
      const builder = new CrepeBuilder({
        root: containerRef.current,
        defaultValue: initialContent
      })

      console.log('✅ Step 2: Adding collaboration plugin FIRST')
      // ✅ Step 2: Add collaboration plugin BEFORE any features
      builder.editor.use(collab)

      console.log('✅ Step 3: Adding all Crepe features manually...')
      // ✅ Step 3: Add all Crepe features manually (this is what Crepe class does internally)
      
      // Add Cursor feature (virtual cursor, drop cursor)
      builder.addFeature(cursor, {
        color: '#3b82f6',
        width: 2,
        virtual: true
      })

      // Add List Item feature (bullets, checkboxes, etc.)
      builder.addFeature(listItem, {})

      // Add Link Tooltip feature (link preview, editing)
      builder.addFeature(linkTooltip, {})

      // Add Image Block feature (image upload, resizing)
      builder.addFeature(imageBlock, {
        onUpload: async (file: File) => {
          // Simple base64 encoding for demo - replace with real upload
          return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
        }
      })

      // Add Block Edit feature (drag handles, slash commands)
      builder.addFeature(blockEdit, {})

      // Add Placeholder feature
      builder.addFeature(placeholder, {
        text: 'Start writing...',
        mode: 'block'
      })

      // Add Toolbar feature (formatting toolbar on selection)
      builder.addFeature(toolbar, {})

      // Add CodeMirror feature (syntax highlighting)
      builder.addFeature(codeMirror, {})

      // Add Table feature (table editing, drag & drop)
      builder.addFeature(table, {})

      // Add LaTeX feature (math rendering)
      builder.addFeature(latex, {})

      console.log('✅ Step 4: Creating the full-featured editor...')
      // ✅ Step 4: NOW create the editor with all features + collaboration
      await builder.create()
      builderRef.current = builder

      console.log('🎉 Full-featured Crepe editor with collaboration created!')

      // ✅ Step 5: Set up collaboration service
      builder.editor.action((ctx) => {
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
                console.log('Applying initial content to collaborative editor...')
                await collabService.applyTemplate(initialContent, () => true)
              }
              
              await collabService.connect()
              setConnectionStatus('synced')
              setIsReady(true)
              setIsLoading(false)
              
              console.log('🎉 FULL-FEATURED collaborative Crepe editor ready!')
              console.log('✨ Features included: Toolbar, Block editing, Slash commands, Tables, Images, LaTeX, etc.')
              
            } catch (syncError) {
              console.error('Error during sync:', syncError)
              setHasError(true)
              setErrorMessage('Sync failed')
              setIsLoading(false)
            }
          }
        })
      })

      // Set up content change detection with better saving
      let lastContent = initialContent
      const interval = setInterval(() => {
        if (builderRef.current && isReady && onChangeRef.current) {
          try {
            const content = builderRef.current.getMarkdown()
            if (content !== lastContent) {
              console.log('📝 Content changed in collaborative editor - triggering save')
              console.log(`Previous: ${lastContent.length} chars, New: ${content.length} chars`)
              lastContent = content
              onChangeRef.current(content)
            }
          } catch (error) {
            console.error('Error reading content for auto-save:', error)
          }
        }
      }, 1000) // Check every second for more responsive saving

      return () => clearInterval(interval)

    } catch (error) {
      console.error('Failed to create full-featured collaborative Crepe editor:', error)
      setHasError(true)
      setErrorMessage('Failed to initialize collaborative editor')
      setIsLoading(false)
      isInitializedRef.current = false
    }
  }, [documentId, initialContent, wsUrl])

  // Initialize editor on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      console.log('🚀 Initializing FULL-FEATURED Collaborative Crepe Editor')
      const timer = setTimeout(() => {
        initializeEditor().catch(error => {
          console.error('Failed to initialize full-featured collaborative editor:', error)
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
      console.log('🧹 Full-Featured Collaborative Crepe unmounting')
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
    if (connectionStatus === 'synced') return 'Collaborative Crepe'
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
              {collaborators > 1 && (
                <span className="text-purple-600">• {collaborators} users</span>
              )}
              <span className="text-blue-600 text-xs">• Auto-save</span>
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
          height: 'calc(100% - 48px)',
          width: '100%'
        }}
      />
      
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/80">
                      <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <div className="font-medium">
              {isLoading ? 'Loading Collaborative Crepe...' : 'Preparing editor...'}
            </div>
            <div className="text-xs mt-1 text-muted-foreground">
              Full Crepe features with real-time collaboration
            </div>
          </div>
        </div>
      )}
    </div>
  )
}