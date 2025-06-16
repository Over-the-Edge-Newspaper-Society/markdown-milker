// src/components/editor/hooks/useCollaboration.ts
'use client'

import { useRef, useState, useCallback } from 'react'
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
  const initialContentAppliedRef = useRef(false)
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [collaborators, setCollaborators] = useState(0)

  const setupCollaboration = useCallback(async (builder: CrepeBuilder) => {
    console.log('🤝 Setting up Y.js collaboration...')
    
    // Note: collab plugin is now added in useCrepeEditor before builder.create()
    
    const ydoc = new Doc()
    ydocRef.current = ydoc

    const provider = new WebsocketProvider(wsUrl, documentId, ydoc, {
      connect: true,
      params: { documentId },
      resyncInterval: 2000,
      maxBackoffTime: 1000
    })
    providerRef.current = provider

    provider.awareness.setLocalStateField('user', {
      color: randomColor(),
      name: `User-${Math.floor(Math.random() * 1000)}`
    })

    // Event listeners
    provider.on('status', (payload: { status: string }) => {
      setConnectionStatus(payload.status as ConnectionStatus)
    })

    provider.on('connection-close', () => setConnectionStatus('disconnected'))
    provider.on('connection-error', () => setConnectionStatus('error'))

    provider.awareness.on('change', () => {
      const states = provider.awareness.getStates()
      setCollaborators(states.size)
    })

    return new Promise<void>((resolve, reject) => {
      builder.editor.action((ctx) => {
        try {
          const collabService = ctx.get(collabServiceCtx)
          collabService.bindDoc(ydoc).setAwareness(provider.awareness)

          provider.once('synced', async (isSynced: boolean) => {
            if (isSynced) {
              try {
                await collabService.connect()
                
                // Apply initial content if needed
                if (initialContent && !initialContentAppliedRef.current) {
                  const currentCollaborators = provider.awareness.getStates().size
                  
                  if (currentCollaborators <= 1) {
                    const yText = ydoc.getText('milkdown')
                    const existingContent = yText.toString()
                    
                    if (!existingContent && initialContent.trim()) {
                      await collabService.applyTemplate(initialContent, () => true)
                    }
                  }
                  initialContentAppliedRef.current = true
                }
                
                setConnectionStatus('synced')
                resolve()
              } catch (error) {
                console.error('Collaboration setup error:', error)
                reject(error)
              }
            }
          })
        } catch (error) {
          console.error('Failed to get collaboration service:', error)
          reject(error)
        }
      })
    })
  }, [documentId, wsUrl, initialContent])

  const cleanup = useCallback(() => {
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
    
    setConnectionStatus('disconnected')
    setCollaborators(0)
    initialContentAppliedRef.current = false
  }, [])

  return {
    connectionStatus,
    collaborators,
    setupCollaboration,
    cleanup
  }
}