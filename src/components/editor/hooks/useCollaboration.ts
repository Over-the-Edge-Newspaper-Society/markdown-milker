// src/components/editor/hooks/useCollaboration.ts
'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { collab, collabServiceCtx } from '@milkdown/plugin-collab'
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs'
import { CrepeBuilder } from '@milkdown/crepe/builder'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'synced' | 'solo'

interface UseCollaborationProps {
  documentId: string
  wsUrl: string
  initialContent: string
}

const randomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16)

export function useCollaboration({ documentId, wsUrl, initialContent }: UseCollaborationProps) {
  const ydocRef = useRef<Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const collabServiceRef = useRef<any>(null)
  const initialContentAppliedRef = useRef(false)
  const isCleaningUpRef = useRef(false)
  const setupTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [collaborators, setCollaborators] = useState(0)

  const setupCollaboration = useCallback(async (builder: CrepeBuilder) => {
    // Prevent multiple setup calls
    if (isCleaningUpRef.current || ydocRef.current || providerRef.current) {
      console.log('🚫 Collaboration setup already in progress or cleaning up')
      return
    }

    console.log('🤝 Setting up Y.js collaboration...')
    
    try {
      // Create Y.js document first
      const ydoc = new Doc()
      ydocRef.current = ydoc

      // Create WebSocket provider
      const provider = new WebsocketProvider(wsUrl, documentId, ydoc, {
        connect: true,
        params: { documentId },
        resyncInterval: 2000,
        maxBackoffTime: 1000
      })
      providerRef.current = provider

      // Set user awareness
      provider.awareness.setLocalStateField('user', {
        color: randomColor(),
        name: `User-${Math.floor(Math.random() * 1000)}`
      })

      // Set up event listeners with cleanup checks
      const handleStatus = (payload: { status: string }) => {
        if (isCleaningUpRef.current) return
        console.log('📡 WebSocket status:', payload.status)
        setConnectionStatus(payload.status as ConnectionStatus)
      }

      const handleConnectionClose = () => {
        if (isCleaningUpRef.current) return
        console.log('📡 WebSocket connection closed')
        setConnectionStatus('disconnected')
      }

      const handleConnectionError = (error: any) => {
        if (isCleaningUpRef.current) return
        console.error('📡 WebSocket connection error:', error)
        setConnectionStatus('error')
      }

      const handleAwarenessChange = () => {
        if (isCleaningUpRef.current) return
        const states = provider.awareness.getStates()
        setCollaborators(states.size)
      }

      // Add event listeners
      provider.on('status', handleStatus)
      provider.on('connection-close', handleConnectionClose)
      provider.on('connection-error', handleConnectionError)
      provider.awareness.on('change', handleAwarenessChange)

      // Set up collaboration with timeout
      const setupPromise = new Promise<void>((resolve, reject) => {
        builder.editor.action((ctx) => {
          try {
            const collabService = ctx.get(collabServiceCtx)
            collabServiceRef.current = collabService
            
            collabService.bindDoc(ydoc).setAwareness(provider.awareness)

            const handleSynced = async (isSynced: boolean) => {
              if (isCleaningUpRef.current) {
                reject(new Error('Cleanup in progress'))
                return
              }

              if (isSynced) {
                try {
                  await collabService.connect()
                  
                  // Apply initial content if needed and we're the first/only user
                  if (initialContent && !initialContentAppliedRef.current) {
                    const currentCollaborators = provider.awareness.getStates().size
                    
                    if (currentCollaborators <= 1) {
                      const yText = ydoc.getText('milkdown')
                      const existingContent = yText.toString()
                      
                      if (!existingContent && initialContent.trim()) {
                        console.log('📝 Applying initial content to collaborative document')
                        await collabService.applyTemplate(initialContent, () => true)
                      }
                    }
                    initialContentAppliedRef.current = true
                  }
                  
                  if (!isCleaningUpRef.current) {
                    setConnectionStatus('synced')
                    resolve()
                  }
                } catch (error) {
                  reject(error)
                }
              }
            }

            provider.once('synced', handleSynced)
            
            // Fallback timeout
            setupTimeoutRef.current = setTimeout(() => {
              if (!isCleaningUpRef.current) {
                console.warn('⏰ Collaboration setup timeout')
                reject(new Error('Setup timeout'))
              }
            }, 10000)
            
          } catch (error) {
            reject(error)
          }
        })
      })

      await setupPromise
      
    } catch (error) {
      console.error('❌ Collaboration setup failed:', error)
      // Clean up on error
      cleanup()
      throw error
    }
  }, [documentId, wsUrl, initialContent])

  const cleanup = useCallback(() => {
    console.log('🧹 Starting collaboration cleanup...')
    isCleaningUpRef.current = true

    // Clear setup timeout
    if (setupTimeoutRef.current) {
      clearTimeout(setupTimeoutRef.current)
      setupTimeoutRef.current = null
    }

    // Step 1: Disconnect and destroy provider first to stop Y.js updates
    if (providerRef.current) {
      try {
        console.log('🔌 Disconnecting WebSocket provider...')
        providerRef.current.disconnect()
        
        // Remove all event listeners to prevent further updates
        providerRef.current.removeAllListeners()
        providerRef.current.awareness.removeAllListeners()
        
        // Destroy the provider
        providerRef.current.destroy()
        console.log('✅ WebSocket provider destroyed')
      } catch (error) {
        console.error('⚠️ Error destroying provider:', error)
      }
      providerRef.current = null
    }

    // Step 2: Disconnect collaboration service
    if (collabServiceRef.current) {
      try {
        console.log('🔌 Disconnecting collaboration service...')
        // Try to disconnect gracefully
        if (typeof collabServiceRef.current.disconnect === 'function') {
          collabServiceRef.current.disconnect()
        }
        console.log('✅ Collaboration service disconnected')
      } catch (error) {
        console.error('⚠️ Error disconnecting collaboration service:', error)
      }
      collabServiceRef.current = null
    }

    // Step 3: Destroy Y.js document last
    if (ydocRef.current) {
      try {
        console.log('📄 Destroying Y.js document...')
        ydocRef.current.destroy()
        console.log('✅ Y.js document destroyed')
      } catch (error) {
        console.error('⚠️ Error destroying Y.js doc:', error)
      }
      ydocRef.current = null
    }
    
    // Reset state
    setConnectionStatus('disconnected')
    setCollaborators(0)
    initialContentAppliedRef.current = false
    
    console.log('✅ Collaboration cleanup completed')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    connectionStatus,
    collaborators,
    setupCollaboration,
    cleanup
  }
}